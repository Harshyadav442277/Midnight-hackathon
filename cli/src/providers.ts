/**
 * Midnight.js providers. Six fields, wired for Node against Preview.
 */

import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';

import type { NightSealCircuits } from '@nightseal/contract';
import { PREVIEW, PRIVATE_STATE_STORE, ZK_CONFIG_PATH } from './config.ts';
import type { NightSealWallet } from './wallet.ts';

export const buildProviders = (wallet: NightSealWallet) => {
  const zkConfigProvider = new NodeZkConfigProvider<NightSealCircuits>(ZK_CONFIG_PATH);
  const accountId = wallet.getCoinPublicKey();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: PRIVATE_STATE_STORE,
      signingKeyStoreName: `${PRIVATE_STATE_STORE}-signing-keys`,
      accountId,
      privateStoragePasswordProvider: () =>
        `${Buffer.from(String(accountId)).toString('base64')}!`,
    }),
    publicDataProvider: indexerPublicDataProvider(PREVIEW.indexer, PREVIEW.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(PREVIEW.proofServer, zkConfigProvider),
    walletProvider: wallet,
    midnightProvider: wallet,
  };
};

export type NightSealProviders = ReturnType<typeof buildProviders>;
