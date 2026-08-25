/**
 * Public auditor endpoint.
 *
 * Reads the registry's public ledger state straight from the Midnight indexer. No
 * wallet, no seed, no proof server — which is the product claim made literal: anyone
 * can audit compliance with nothing but a URL, and still sees no firmware data.
 *
 * Privileged actions are deliberately absent; they need the operator key and run on
 * the operator's own machine. This file imports no workspace TypeScript so it bundles
 * cleanly as a serverless function: the ledger decoder is the committed compiler
 * output, and fleet metadata is the shared JSON manifest.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import { ledger as readLedger } from '../contract/src/managed/nightseal/contract/index.js';

const NETWORK = 'preview';
const INDEXER = 'https://indexer.preview.midnight.network/api/v4/graphql';
const INDEXER_WS = 'wss://indexer.preview.midnight.network/api/v4/graphql/ws';
const EXPLORER = 'https://preview.midnightexplorer.com';

const CONTRACT_ADDRESS = process.env.NIGHTSEAL_CONTRACT_ADDRESS ?? '';

type Manifest = {
  builds: { id: string; version: string; index: number; note: string }[];
  devices: { id: string; label: string; buildId: string }[];
};

const manifest = JSON.parse(
  readFileSync(new URL('../fleet.json', import.meta.url), 'utf8'),
) as Manifest;

const deviceKey = (id: string): Uint8Array =>
  new Uint8Array(createHash('sha256').update(`device:${id}`).digest());

const jsonSafe = (value: unknown): string =>
  JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));

export default async function handler(_req: unknown, res: any): Promise<void> {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 's-maxage=5, stale-while-revalidate=30');

  if (!CONTRACT_ADDRESS) {
    res
      .status(200)
      .send(jsonSafe({ error: 'NIGHTSEAL_CONTRACT_ADDRESS is not set for this deployment.' }));
    return;
  }

  try {
    setNetworkId(NETWORK);
    const publicData = indexerPublicDataProvider(INDEXER, INDEXER_WS);
    const contractState = await publicData.queryContractState(CONTRACT_ADDRESS);
    if (!contractState) throw new Error(`No contract found at ${CONTRACT_ADDRESS}`);

    const state = readLedger(contractState.data);
    const baselineEpoch = state.baselineEpoch;

    res.status(200).send(
      jsonSafe({
        readOnly: true,
        network: NETWORK,
        contractAddress: CONTRACT_ADDRESS,
        explorer: `${EXPLORER}/contract/${CONTRACT_ADDRESS}`,
        explorerBase: EXPLORER,
        baselineEpoch,
        approvedRoot: state.approvedSet.root().field,
        devices: manifest.devices.map((device) => {
          const key = deviceKey(device.id);
          const attested = state.deviceStatus.member(key) ? state.deviceStatus.lookup(key) : 0;
          const epoch = state.deviceEpoch.member(key) ? state.deviceEpoch.lookup(key) : null;
          const status =
            attested !== 1 || epoch === null
              ? 'NEVER ATTESTED'
              : epoch === baselineEpoch
                ? 'COMPLIANT'
                : 'RE-ATTESTATION REQUIRED';
          return { id: device.id, label: device.label, status, epoch, lastAttempt: null };
        }),
        builds: manifest.builds,
        fleet: manifest.devices,
      }),
    );
  } catch (err) {
    res.status(200).send(jsonSafe({ error: err instanceof Error ? err.message : String(err) }));
  }
}
