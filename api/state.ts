/**
 * Public auditor endpoint (Vercel).
 *
 * Reads the registry's public ledger state straight from the Midnight indexer. No
 * wallet, no seed, no proof server — which is the product claim made literal: anyone
 * can audit compliance with nothing but a URL, and still sees no firmware data.
 *
 * Privileged actions are deliberately absent here; they need the operator key and run
 * on the operator's own machine.
 */

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ledger as readLedger } from '@nightseal/contract';

import { BUILDS, DEVICES, deviceKey } from '../cli/src/fleet.ts';

const NETWORK = 'preview';
const INDEXER = 'https://indexer.preview.midnight.network/api/v4/graphql';
const INDEXER_WS = 'wss://indexer.preview.midnight.network/api/v4/graphql/ws';
const EXPLORER = 'https://preview.midnightexplorer.com';

const CONTRACT_ADDRESS = process.env.NIGHTSEAL_CONTRACT_ADDRESS ?? '';

const jsonSafe = (value: unknown): string =>
  JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));

export default async function handler(_req: unknown, res: any): Promise<void> {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 's-maxage=5, stale-while-revalidate=30');

  if (!CONTRACT_ADDRESS) {
    res.status(200).send(
      jsonSafe({ error: 'NIGHTSEAL_CONTRACT_ADDRESS is not configured for this deployment.' }),
    );
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
        devices: DEVICES.map((device) => {
          const key = deviceKey(device);
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
        builds: BUILDS.map((b) => ({ id: b.id, version: b.version, index: b.index, note: b.note })),
        fleet: DEVICES.map((d) => ({ id: d.id, label: d.label, buildId: d.buildId })),
      }),
    );
  } catch (err) {
    res.status(200).send(jsonSafe({ error: err instanceof Error ? err.message : String(err) }));
  }
}
