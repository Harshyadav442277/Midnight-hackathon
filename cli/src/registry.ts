/**
 * Registry operations: deploy, approve, revoke, attest, and read public state.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import {
  NightSealContract,
  createNightSealPrivateState,
  ledger as readLedger,
  pureCircuits,
  type NightSealPrivateState,
} from '@nightseal/contract';

import { PRIVATE_STATE_ID, explorerContract } from './config.ts';
import { BUILDS, buildForDevice, deviceKey, digest, type Device, type FirmwareBuild } from './fleet.ts';
import { logger } from './logger.ts';
import type { NightSealProviders } from './providers.ts';

const DEPLOYMENT_PATH = new URL('../../deployment.json', import.meta.url).pathname;

export type Deployment = { contractAddress: string; network: string; deployedAt: string };

export const saveDeployment = (d: Deployment): void =>
  writeFileSync(DEPLOYMENT_PATH, `${JSON.stringify(d, null, 2)}\n`, 'utf8');

export const loadDeployment = (): Deployment => {
  const found = findDeployment();
  if (!found) throw new Error('No deployment.json found — run:  npm start -- deploy');
  return found;
};

export const findDeployment = (): Deployment | null =>
  existsSync(DEPLOYMENT_PATH)
    ? (JSON.parse(readFileSync(DEPLOYMENT_PATH, 'utf8')) as Deployment)
    : null;

/** The operator's identity key, derived deterministically from its wallet seed. */
export const operatorSecretKey = (seed: string): Uint8Array => digest(`nightseal:operator:${seed}`);

export const operatorState = (seed: string): NightSealPrivateState =>
  createNightSealPrivateState(operatorSecretKey(seed), digest('unused'), digest('unused'));

export const deviceState = (build: FirmwareBuild): NightSealPrivateState =>
  createNightSealPrivateState(digest('nightseal:device'), build.measurement, build.randomness);

/** Commitment the operator publishes for a firmware build. */
export const commitmentFor = (build: FirmwareBuild): Uint8Array =>
  pureCircuits.firmwareCommitment(build.measurement, build.randomness);

export const deployRegistry = async (providers: NightSealProviders, seed: string) => {
  logger.info('Deploying the NightSeal registry to Midnight Preview...');
  const deployed = await deployContract(providers, {
    compiledContract: NightSealContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: operatorState(seed),
  });
  const contractAddress = deployed.deployTxData.public.contractAddress;
  saveDeployment({
    contractAddress,
    network: 'preview',
    deployedAt: new Date().toISOString(),
  });
  logger.info(`Deployed at ${contractAddress}`);
  logger.info(`Explorer: ${explorerContract(contractAddress)}`);
  return deployed;
};

export const joinRegistry = async (
  providers: NightSealProviders,
  contractAddress: string,
  privateState: NightSealPrivateState,
) => {
  await providers.privateStateProvider.set(PRIVATE_STATE_ID, privateState);
  return findDeployedContract(providers, {
    contractAddress,
    compiledContract: NightSealContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: privateState,
  });
};

const txHashOf = (txData: unknown): string => {
  const pub = (txData as { public?: Record<string, unknown> }).public ?? {};
  return String(pub.txHash ?? pub.txId ?? 'unknown');
};

/** Publish the whole demo baseline: every known build becomes an approved leaf. */
export const approveAllBuilds = async (
  providers: NightSealProviders,
  contractAddress: string,
  seed: string,
): Promise<string[]> => {
  const contract = await joinRegistry(providers, contractAddress, operatorState(seed));
  const hashes: string[] = [];
  for (const build of BUILDS) {
    logger.info(`Approving ${build.version} at leaf ${build.index}...`);
    const tx = await contract.callTx.approveFirmware(commitmentFor(build), build.index);
    hashes.push(txHashOf(tx));
    logger.info(`  approved — tx ${txHashOf(tx)}`);
  }
  return hashes;
};

export const revokeBuild = async (
  providers: NightSealProviders,
  contractAddress: string,
  seed: string,
  build: FirmwareBuild,
): Promise<string> => {
  const contract = await joinRegistry(providers, contractAddress, operatorState(seed));
  logger.info(`Revoking ${build.version} (leaf ${build.index}) — the CVE moment...`);
  const tx = await contract.callTx.revokeFirmware(build.index);
  logger.info(`  revoked — tx ${txHashOf(tx)}`);
  return txHashOf(tx);
};

export const attestDevice = async (
  providers: NightSealProviders,
  contractAddress: string,
  device: Device,
): Promise<string> => {
  const build = buildForDevice(device);
  const contract = await joinRegistry(providers, contractAddress, deviceState(build));
  logger.info(`${device.label} is attesting (proving ${build.version} is approved)...`);
  const tx = await contract.callTx.attest(deviceKey(device));
  logger.info(`  attested — tx ${txHashOf(tx)}`);
  return txHashOf(tx);
};

export type PublicState = {
  baselineEpoch: bigint;
  approvedRoot: bigint;
  devices: { id: string; label: string; status: string; epoch: bigint | null }[];
};

/** Read only what the chain makes public — this is what an auditor sees. */
export const readPublicState = async (
  providers: NightSealProviders,
  contractAddress: string,
  devices: readonly Device[],
): Promise<PublicState> => {
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!contractState) throw new Error(`No contract found at ${contractAddress}`);
  const state = readLedger(contractState.data);

  const baselineEpoch = state.baselineEpoch;
  return {
    baselineEpoch,
    approvedRoot: state.approvedSet.root().field,
    devices: devices.map((device) => {
      const key = deviceKey(device);
      const attested = state.deviceStatus.member(key) ? state.deviceStatus.lookup(key) : 0;
      const epoch = state.deviceEpoch.member(key) ? state.deviceEpoch.lookup(key) : null;
      const status =
        attested !== 1 || epoch === null
          ? 'NEVER ATTESTED'
          : epoch === baselineEpoch
            ? 'COMPLIANT'
            : 'RE-ATTESTATION REQUIRED';
      return { id: device.id, label: device.label, status, epoch };
    }),
  };
};
