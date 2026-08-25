/**
 * Headless wallet for the registry operator and device simulators.
 *
 * Adapted from the official example-bboard CLI wallet provider. The seed lives in
 * .env (gitignored) and is the only secret the CLI holds.
 */

import { randomBytes } from 'node:crypto';

import {
  type CoinPublicKey,
  DustSecretKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
  ZswapSecretKeys,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  type DustWalletOptions,
  type EnvironmentConfiguration,
  FluentWalletBuilder,
} from '@midnight-ntwrk/testkit-js';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { createKeystore } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import * as Rx from 'rxjs';

import type { Logger } from './logger.ts';

type UnshieldedKeystore = {
  getPublicKey(): unknown;
  signData(payload: Uint8Array): string;
};

export const generateSeed = (): string => randomBytes(32).toString('hex');

/** Derive the unshielded (NIGHT) key the faucet pays into. */
const unshieldedSeed = (seed: string): Uint8Array => {
  const result = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (result.type !== 'seedOk') throw new Error(`Invalid wallet seed: ${result.type}`);
  const derived = result.hdWallet.selectAccount(0).selectRole(Roles.NightExternal).deriveKeyAt(0);
  if (derived.type !== 'keyDerived') throw new Error(`Key derivation failed: ${derived.type}`);
  return derived.key;
};

export class NightSealWallet implements MidnightProvider, WalletProvider {
  readonly logger: Logger;
  readonly env: EnvironmentConfiguration;
  readonly wallet: WalletFacade;
  readonly seed: string;
  readonly zswapSecretKeys: ZswapSecretKeys;
  readonly dustSecretKey: DustSecretKey;
  readonly unshieldedKeystore: UnshieldedKeystore;

  private constructor(
    logger: Logger,
    env: EnvironmentConfiguration,
    wallet: WalletFacade,
    seed: string,
    zswapSecretKeys: ZswapSecretKeys,
    dustSecretKey: DustSecretKey,
    unshieldedKeystore: UnshieldedKeystore,
  ) {
    this.logger = logger;
    this.env = env;
    this.wallet = wallet;
    this.seed = seed;
    this.zswapSecretKeys = zswapSecretKeys;
    this.dustSecretKey = dustSecretKey;
    this.unshieldedKeystore = unshieldedKeystore;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl },
    );
    const signed = await this.wallet.signRecipe(recipe, (payload) =>
      this.unshieldedKeystore.signData(payload),
    );
    return this.wallet.finalizeRecipe(signed);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  async start(): Promise<void> {
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  async stop(): Promise<void> {
    await this.wallet.stop();
  }

  /** The address to paste into the faucet — unshielded NIGHT, network-prefixed. */
  async unshieldedAddress(): Promise<string> {
    const state = await Rx.firstValueFrom(this.wallet.unshielded.state);
    return UnshieldedAddress.codec.encode(getNetworkId(), state.address).toString();
  }

  async balances(): Promise<{ night: bigint; dust: bigint }> {
    const state = await Rx.firstValueFrom(this.wallet.state());
    const night = Object.values(state.unshielded.balances ?? {}).reduce<bigint>(
      (sum, v) => sum + BigInt(v as unknown as bigint),
      0n,
    );
    return { night, dust: state.dust.balance(new Date()) };
  }

  /**
   * Register unshielded NIGHT for DUST generation. Faucet tokens cannot pay fees on
   * their own; DUST is what fees are actually paid in.
   */
  async generateDust(): Promise<string | undefined> {
    const dustState = await this.wallet.dust.waitForSyncedState();
    const unshielded = await Rx.firstValueFrom(this.wallet.unshielded.state);
    const keystore = createKeystore(unshieldedSeed(this.seed), getNetworkId());

    const utxos = unshielded.availableCoins.filter(
      (coin) => !coin.meta.registeredForDustGeneration,
    );
    if (utxos.length === 0) {
      this.logger.info('All NIGHT is already registered for DUST generation.');
      return undefined;
    }

    this.logger.info(`Registering ${utxos.length} NIGHT UTXO(s) for DUST generation...`);
    const recipe = await this.wallet.registerNightUtxosForDustGeneration(
      utxos,
      keystore.getPublicKey(),
      (payload) => keystore.signData(payload),
      dustState.address,
    );
    const tx = await this.wallet.finalizeRecipe(recipe);
    const txId = await this.wallet.submitTransaction(tx);
    this.logger.info({ txId }, 'DUST registration submitted');
    return txId;
  }

  /** Block until the wallet has synced with the indexer. */
  async waitForSync(): Promise<void> {
    const complete = (p: unknown): boolean =>
      !!p &&
      typeof p === 'object' &&
      typeof (p as { isStrictlyComplete?: unknown }).isStrictlyComplete === 'function' &&
      (p as { isStrictlyComplete: () => boolean }).isStrictlyComplete();

    this.logger.info('Syncing wallet with the indexer (first sync can take a few minutes)...');
    await Rx.firstValueFrom(
      this.wallet.state().pipe(
        Rx.throttleTime(3_000),
        Rx.tap((s) =>
          this.logger.debug(
            `sync: shielded=${complete(s.shielded.state.progress)} unshielded=${complete(
              s.unshielded.progress,
            )} dust=${complete(s.dust.state.progress)}`,
          ),
        ),
        Rx.filter(
          (s) =>
            complete(s.shielded.state.progress) &&
            complete(s.unshielded.progress) &&
            complete(s.dust.state.progress),
        ),
      ),
    );
    this.logger.info('Wallet synced.');
  }

  static async build(
    logger: Logger,
    env: EnvironmentConfiguration,
    seed: string,
  ): Promise<NightSealWallet> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: env.walletNetworkId === 'undeployed' ? 500_000_000_000_000_000n : 1_000n,
      feeBlocksMargin: 5,
    };

    const built = (await FluentWalletBuilder.forEnvironment(env)
      .withDustOptions(dustOptions)
      .withSeed(seed)
      .buildWithoutStarting()) as unknown as {
      wallet: WalletFacade;
      seeds: { masterSeed: string; shielded: Uint8Array; dust: Uint8Array };
      keystore: UnshieldedKeystore;
    };

    return new NightSealWallet(
      logger,
      env,
      built.wallet,
      seed,
      ZswapSecretKeys.fromSeed(built.seeds.shielded),
      DustSecretKey.fromSeed(built.seeds.dust),
      built.keystore,
    );
  }
}
