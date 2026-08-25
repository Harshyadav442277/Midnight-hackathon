/**
 * NightSeal CLI — registry operator and device simulator.
 */

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import { PREVIEW, explorerContract } from './config.ts';
import { loadEnv, seedFor } from './env.ts';
import { BUILDS, DEVICES, buildById, deviceById } from './fleet.ts';
import { logger } from './logger.ts';
import { buildProviders } from './providers.ts';
import {
  approveAllBuilds,
  attestDevice,
  deployRegistry,
  loadDeployment,
  readPublicState,
  revokeBuild,
} from './registry.ts';
import { NightSealWallet } from './wallet.ts';

const HELP = `
NightSeal CLI  (network: Midnight Preview)

Setup
  npm start -- address            print the address to fund from the faucet
  npm start -- balance            show NIGHT and DUST balances
  npm start -- dust               register NIGHT for DUST generation (needed to pay fees)

Registry
  npm start -- deploy             deploy the registry and publish the approved baseline
  npm start -- approve            (re)publish every known firmware build as approved
  npm start -- revoke <buildId>   revoke a build — the CVE moment
  npm start -- attest <deviceId>  a device proves its firmware is in the baseline
  npm start -- status             show the public compliance state an auditor sees

  builds:  ${BUILDS.map((b) => b.id).join(', ')}
  devices: ${DEVICES.map((d) => d.id).join(', ')}
`;

/** Everything that touches the chain needs a started, synced wallet. */
const withChain = async <T>(
  fn: (ctx: {
    wallet: NightSealWallet;
    providers: ReturnType<typeof buildProviders>;
    seed: string;
  }) => Promise<T>,
): Promise<T> => {
  setNetworkId(PREVIEW.walletNetworkId);
  const seed = seedFor('operator');
  const wallet = await NightSealWallet.build(logger, PREVIEW, seed);
  try {
    await wallet.start();
    await wallet.waitForSync();
    const { dust } = await wallet.balances();
    if (dust === 0n) {
      logger.warn('DUST balance is 0 — transactions cannot pay fees yet.');
      logger.warn('Fund the address (npm start -- address) then run: npm start -- dust');
    }
    return await fn({ wallet, providers: buildProviders(wallet), seed });
  } finally {
    await wallet.stop().catch(() => undefined);
  }
};

const printStatus = async (
  providers: ReturnType<typeof buildProviders>,
  contractAddress: string,
): Promise<void> => {
  const state = await readPublicState(providers, contractAddress, DEVICES);
  console.log(`\n  Baseline epoch : ${state.baselineEpoch}`);
  console.log(`  Approved root  : ${state.approvedRoot}`);
  console.log('  ─────────────────────────────────────────────────────────');
  for (const d of state.devices) {
    const epoch = d.epoch === null ? '—' : String(d.epoch);
    console.log(`  ${d.label.padEnd(24)} ${d.status.padEnd(24)} epoch ${epoch}`);
  }
  console.log(`\n  Explorer: ${explorerContract(contractAddress)}\n`);
};

const main = async (): Promise<void> => {
  loadEnv();
  const [command = 'help', arg] = process.argv.slice(2);

  switch (command) {
    case 'address': {
      setNetworkId(PREVIEW.walletNetworkId);
      const wallet = await NightSealWallet.build(logger, PREVIEW, seedFor('operator'));
      await wallet.start();
      const address = await wallet.unshieldedAddress();
      await wallet.stop().catch(() => undefined);
      console.log(`\n${address}\n`);
      logger.info(`Paste that into the Preview faucet: ${PREVIEW.faucet}`);
      break;
    }

    case 'balance':
      await withChain(async ({ wallet }) => {
        const { night, dust } = await wallet.balances();
        logger.info(`NIGHT: ${night}   DUST: ${dust}`);
        if (night > 0n && dust === 0n) logger.warn('Run:  npm start -- dust');
      });
      break;

    case 'dust':
      await withChain(async ({ wallet }) => wallet.generateDust());
      break;

    case 'deploy':
      await withChain(async ({ providers, seed }) => {
        const deployed = await deployRegistry(providers, seed);
        const address = deployed.deployTxData.public.contractAddress;
        await approveAllBuilds(providers, address, seed);
        await printStatus(providers, address);
      });
      break;

    case 'approve':
      await withChain(async ({ providers, seed }) => {
        const { contractAddress } = loadDeployment();
        await approveAllBuilds(providers, contractAddress, seed);
        await printStatus(providers, contractAddress);
      });
      break;

    case 'revoke':
      if (!arg) throw new Error(`Usage: npm start -- revoke <${BUILDS.map((b) => b.id).join('|')}>`);
      await withChain(async ({ providers, seed }) => {
        const { contractAddress } = loadDeployment();
        await revokeBuild(providers, contractAddress, seed, buildById(arg));
        await printStatus(providers, contractAddress);
      });
      break;

    case 'attest':
      if (!arg) throw new Error(`Usage: npm start -- attest <${DEVICES.map((d) => d.id).join('|')}>`);
      await withChain(async ({ providers }) => {
        const { contractAddress } = loadDeployment();
        await attestDevice(providers, contractAddress, deviceById(arg));
        await printStatus(providers, contractAddress);
      });
      break;

    case 'status':
      await withChain(async ({ providers }) => {
        const { contractAddress } = loadDeployment();
        await printStatus(providers, contractAddress);
      });
      break;

    default:
      console.log(HELP);
  }
};

main().then(
  () => process.exit(0),
  (err) => {
    logger.error(err instanceof Error ? err.message : String(err));
    if (process.env.LOG_LEVEL === 'debug') console.error(err);
    process.exit(1);
  },
);
