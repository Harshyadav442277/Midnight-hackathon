/**
 * Network configuration. NightSeal targets Midnight Preview.
 *
 * Endpoints come from the official environment reference; the proof server is always
 * local because it handles private data — there is no hosted proof server.
 */

import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';

export const PROOF_SERVER = process.env.PROOF_SERVER ?? 'http://localhost:6300';

export const PREVIEW: EnvironmentConfiguration = {
  walletNetworkId: 'preview',
  networkId: 'preview',
  indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preview.midnight.network',
  nodeWS: 'wss://rpc.preview.midnight.network',
  faucet: 'https://midnight-tmnight-preview.nethermind.dev/',
  proofServer: PROOF_SERVER,
};

export const EXPLORER = 'https://preview.midnightexplorer.com';

// Paths are plural — the singular forms 404.
export const explorerTx = (txHash: string): string => `${EXPLORER}/transactions/${txHash}`;
export const explorerContract = (address: string): string => `${EXPLORER}/contracts/${address}`;

/** Where the compiled circuit assets live, for the ZK config provider. */
export const ZK_CONFIG_PATH = new URL('../../contract/src/managed/nightseal', import.meta.url)
  .pathname;

export const PRIVATE_STATE_STORE = 'nightseal-private-state';
export const PRIVATE_STATE_ID = 'nightsealPrivateState';
