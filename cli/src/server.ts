/**
 * Operator service.
 *
 * Serves the auditor dashboard's read-only view of public ledger state, and exposes
 * the privileged actions (approve / revoke / attest) that need the operator wallet.
 * Uses node:http so the demo has no extra runtime dependencies.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import { EXPLORER, PREVIEW, explorerContract } from './config.ts';
import { loadEnv, seedFor } from './env.ts';
import { BUILDS, DEVICES, buildById, deviceById } from './fleet.ts';
import { logger } from './logger.ts';
import { buildProviders, type NightSealProviders } from './providers.ts';
import {
  approveAllBuilds,
  attestDevice,
  loadDeployment,
  readPublicState,
  revokeBuild,
} from './registry.ts';
import { NightSealWallet } from './wallet.ts';

const PORT = Number(process.env.PORT ?? 8787);
const UI_DIR = new URL('../../ui/dist', import.meta.url).pathname;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

type Ctx = { providers: NightSealProviders; seed: string; contractAddress: string };

/**
 * Outcome of the most recent attestation attempt per device.
 *
 * This is service state, NOT ledger state. A rejected attestation writes nothing
 * on-chain — proving non-membership is exactly what NightSeal refuses to do — so the
 * rejection is recorded here and the UI labels it as an attempt, not as chain data.
 */
type Attempt = { ok: boolean; error?: string; at: string; epoch: string };
const attempts = new Map<string, Attempt>();

/** Chain writes are serialised — two transactions racing on one wallet will fail. */
let queue: Promise<unknown> = Promise.resolve();
const serialise = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
};

const json = (res: import('node:http').ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(payload);
};

const serveStatic = async (
  res: import('node:http').ServerResponse,
  urlPath: string,
): Promise<void> => {
  const rel = urlPath === '/' ? 'index.html' : normalize(urlPath).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(UI_DIR, rel));
    res.writeHead(200, { 'content-type': MIME[extname(rel)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    try {
      // SPA fallback.
      const body = await readFile(join(UI_DIR, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html']! });
      res.end(body);
    } catch {
      res.writeHead(404).end('Build the UI first:  npm run build --workspace ui');
    }
  }
};

const handle = async (
  ctx: Ctx,
  method: string,
  path: string,
): Promise<{ status: number; body: unknown }> => {
  if (method === 'GET' && path === '/api/state') {
    const state = await readPublicState(ctx.providers, ctx.contractAddress, DEVICES);
    return {
      status: 200,
      body: {
        ...state,
        devices: state.devices.map((d) => ({ ...d, lastAttempt: attempts.get(d.id) ?? null })),
        contractAddress: ctx.contractAddress,
        explorer: explorerContract(ctx.contractAddress),
        explorerBase: EXPLORER,
        network: PREVIEW.networkId,
        builds: BUILDS.map((b) => ({ id: b.id, version: b.version, index: b.index, note: b.note })),
        fleet: DEVICES.map((d) => ({ id: d.id, label: d.label, buildId: d.buildId })),
      },
    };
  }

  if (method === 'POST' && path.startsWith('/api/attest/')) {
    const device = deviceById(decodeURIComponent(path.slice('/api/attest/'.length)));
    const epoch = String(
      (await readPublicState(ctx.providers, ctx.contractAddress, [])).baselineEpoch,
    );
    try {
      const txHash = await serialise(() =>
        attestDevice(ctx.providers, ctx.contractAddress, device),
      );
      attempts.set(device.id, { ok: true, at: new Date().toISOString(), epoch });
      return { status: 200, body: { ok: true, txHash, explorer: `${EXPLORER}/tx/${txHash}` } };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      attempts.set(device.id, { ok: false, error, at: new Date().toISOString(), epoch });
      return { status: 200, body: { ok: false, error } };
    }
  }

  if (method === 'POST' && path.startsWith('/api/revoke/')) {
    const build = buildById(decodeURIComponent(path.slice('/api/revoke/'.length)));
    const txHash = await serialise(() =>
      revokeBuild(ctx.providers, ctx.contractAddress, ctx.seed, build),
    );
    return { status: 200, body: { ok: true, txHash, explorer: `${EXPLORER}/tx/${txHash}` } };
  }

  if (method === 'POST' && path === '/api/approve') {
    const txHashes = await serialise(() =>
      approveAllBuilds(ctx.providers, ctx.contractAddress, ctx.seed),
    );
    return { status: 200, body: { ok: true, txHashes } };
  }

  return { status: 404, body: { error: `No route for ${method} ${path}` } };
};

const main = async (): Promise<void> => {
  loadEnv();
  setNetworkId(PREVIEW.walletNetworkId);

  const { contractAddress } = loadDeployment();
  const seed = seedFor('operator');
  const wallet = await NightSealWallet.build(logger, PREVIEW, seed);
  await wallet.start();
  await wallet.waitForSync();

  const ctx: Ctx = { providers: buildProviders(wallet), seed, contractAddress };

  createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    if (!path.startsWith('/api/')) {
      void serveStatic(res, path);
      return;
    }
    handle(ctx, req.method ?? 'GET', path).then(
      ({ status, body }) => json(res, status, body),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ path, message }, 'request failed');
        // A failed attestation is a real product outcome, not a server bug.
        json(res, 200, { ok: false, error: message });
      },
    );
  }).listen(PORT, () => {
    logger.info(`NightSeal operator service on http://localhost:${PORT}`);
    logger.info(`Registry ${contractAddress}`);
  });

  const shutdown = async (): Promise<void> => {
    await wallet.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
};

main().catch((err: unknown) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
