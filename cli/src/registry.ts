/**
 * Registry operations: deploy, approve, revoke, attest, and read public state.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import {
  NightSealContract,
  createNightSealPrivateState,
  ledger as readLedger,
  pureCircuits,
  type ComponentVector,
  type NightSealPrivateState,
} from '@nightseal/contract';

import { PRIVATE_STATE_ID, explorerContract } from './config.ts';
import { explain } from './errors.ts';
import {
  BUILDS,
  COMPONENTS,
  DEVICES,
  buildForDevice,
  componentsForBuild,
  deviceKey,
  deviceSecret,
  digest,
  type Component,
  type Device,
  type FirmwareBuild,
} from './fleet.ts';
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

const UNUSED_COMPONENTS: ComponentVector = [
  digest('unused-component-0'),
  digest('unused-component-1'),
  digest('unused-component-2'),
];

export const operatorState = (seed: string): NightSealPrivateState =>
  createNightSealPrivateState(
    operatorSecretKey(seed),
    digest('unused'),
    digest('unused'),
    UNUSED_COMPONENTS,
    UNUSED_COMPONENTS,
  );

export const deviceState = (
  device: Device,
  build: FirmwareBuild,
  provisioningSeed: string,
): NightSealPrivateState => {
  const components = componentsForBuild(build);
  return createNightSealPrivateState(
    deviceSecret(device, provisioningSeed),
    build.measurement,
    build.randomness,
    [components[0].measurement, components[1].measurement, components[2].measurement],
    [components[0].randomness, components[1].randomness, components[2].randomness],
  );
};

export const componentCommitmentFor = (component: Component): Uint8Array =>
  pureCircuits.componentCommitment(component.measurement, component.randomness);

export const componentManifestFor = (build: FirmwareBuild): Uint8Array => {
  const components = componentsForBuild(build);
  return pureCircuits.componentManifest([
    componentCommitmentFor(components[0]),
    componentCommitmentFor(components[1]),
    componentCommitmentFor(components[2]),
  ]);
};

/** Commitment the operator publishes for a firmware build. */
export const commitmentFor = (build: FirmwareBuild): Uint8Array =>
  pureCircuits.firmwareCommitment(
    build.measurement,
    componentManifestFor(build),
    build.randomness,
  );

export const deviceIdentityFor = (device: Device, provisioningSeed: string): Uint8Array =>
  pureCircuits.deviceIdentity(deviceSecret(device, provisioningSeed));

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
  // The level private-state provider scopes state by contract address and throws on
  // any access before setContractAddress; midnight-js only sets it inside its own
  // deploy/find flows, which run after this manual role-switching write.
  providers.privateStateProvider.setContractAddress(contractAddress);
  await providers.privateStateProvider.set(PRIVATE_STATE_ID, privateState);
  return findDeployedContract(providers, {
    contractAddress,
    compiledContract: NightSealContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: privateState,
  });
};

/** Register each device's public id against a private identity-secret commitment. */
export const registerAllDevices = async (
  providers: NightSealProviders,
  contractAddress: string,
  seed: string,
): Promise<string[]> => {
  const contract = await joinRegistry(providers, contractAddress, operatorState(seed));
  const hashes: string[] = [];
  for (const device of DEVICES) {
    logger.info(`Registering cryptographic identity for ${device.label}...`);
    const tx = await contract.callTx.registerDevice(
      deviceKey(device),
      deviceIdentityFor(device, seed),
    );
    hashes.push(txHashOf(tx));
    logger.info(`  registered — tx ${txHashOf(tx)}`);
  }
  return hashes;
};

/** Publish every currently allowed component as an opaque capability leaf. */
export const approveAllComponents = async (
  providers: NightSealProviders,
  contractAddress: string,
  seed: string,
): Promise<string[]> => {
  const contract = await joinRegistry(providers, contractAddress, operatorState(seed));
  const hashes: string[] = [];
  for (const component of COMPONENTS) {
    logger.info(`Approving component capability ${component.label} at leaf ${component.index}...`);
    const tx = await contract.callTx.updateComponentLeaf(
      componentCommitmentFor(component),
      component.index,
    );
    hashes.push(txHashOf(tx));
    logger.info(`  component approved — tx ${txHashOf(tx)}`);
  }
  return hashes;
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
    const tx = await contract.callTx.updateFirmwareLeaf(commitmentFor(build), build.index);
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
  const tx = await contract.callTx.updateFirmwareLeaf(randomBytes(32), build.index);
  logger.info(`  revoked — tx ${txHashOf(tx)}`);
  return txHashOf(tx);
};

export const revokeComponent = async (
  providers: NightSealProviders,
  contractAddress: string,
  seed: string,
  component: Component,
): Promise<string> => {
  const contract = await joinRegistry(providers, contractAddress, operatorState(seed));
  logger.info(
    `Revoking hidden component ${component.label} (leaf ${component.index}) — cascading CVE moment...`,
  );
  const tx = await contract.callTx.updateComponentLeaf(randomBytes(32), component.index);
  logger.info(`  component revoked — tx ${txHashOf(tx)}`);
  return txHashOf(tx);
};

export const attestDevice = async (
  providers: NightSealProviders,
  contractAddress: string,
  device: Device,
  provisioningSeed: string,
): Promise<string> => {
  const build = buildForDevice(device);
  const contract = await joinRegistry(
    providers,
    contractAddress,
    deviceState(device, build, provisioningSeed),
  );
  logger.info(
    `${device.label} is attesting (registered identity + firmware + hidden components)...`,
  );
  const tx = await contract.callTx.attest(deviceKey(device));
  logger.info(`  attested — tx ${txHashOf(tx)}`);
  return txHashOf(tx);
};

/**
 * Prove a device's attestation and keep it, unbalanced, instead of sending it.
 *
 * The proof is honest — it demonstrates Merkle paths to the roots that are current right
 * now, and those roots go into the transaction's public transcript. If the baseline moves
 * before the transaction is applied, the ledger replays that transcript against present
 * state, its own `checkRoot` query answers differently, and consensus rejects it. That
 * turns a stale proof's failure into a chain verdict instead of a local one.
 *
 * Capture happens at `balanceTx`, before fees are attached, because a balanced transaction
 * reserves the wallet's DUST — holding one would starve the revocation that has to follow.
 */
export const buildHeldAttestation = async (
  providers: NightSealProviders,
  contractAddress: string,
  device: Device,
  provisioningSeed: string,
): Promise<UnboundTransaction> => {
  const build = buildForDevice(device);
  const wallet = providers.walletProvider;
  let capture!: (tx: UnboundTransaction) => void;
  let captured = false;
  const held = new Promise<UnboundTransaction>((resolve) => {
    capture = resolve;
  });

  // Proving is the real path; only fee-balancing is intercepted. Throwing afterwards ends
  // the call cleanly, since there is nothing left for it to submit. Methods are delegated
  // explicitly because the provider bundle is typed to the concrete wallet class.
  const capturing = {
    ...providers,
    walletProvider: {
      getCoinPublicKey: () => wallet.getCoinPublicKey(),
      getEncryptionPublicKey: () => wallet.getEncryptionPublicKey(),
      balanceTx: async (tx: UnboundTransaction): Promise<never> => {
        captured = true;
        capture(tx);
        throw new Error('NightSeal: attestation held for replay');
      },
    },
  } as unknown as NightSealProviders;

  const contract = await joinRegistry(
    capturing,
    contractAddress,
    deviceState(device, build, provisioningSeed),
  );

  logger.info(`${device.label} is proving an attestation against the CURRENT baseline...`);

  // The interceptor throws once it has the transaction, so this call is expected to reject.
  // But it also rejects when proving genuinely fails — e.g. the component is already revoked
  // — and then nothing would ever capture, leaving `held` pending forever and hanging the
  // caller's request queue. Racing the two turns that into a clean error.
  const attempt = contract.callTx.attest(deviceKey(device)).then(
    () => Promise.reject(new Error('attestation was submitted instead of held')),
    (err: unknown) =>
      captured
        ? held // the interceptor's own throw, after it already handed us the transaction
        : Promise.reject(new Error(`could not build a proof to replay: ${explain(err)}`)),
  );

  return Promise.race([held, attempt]);
};

/**
 * Balance and send a previously held attestation, then report the ledger's verdict.
 * Balancing happens here so the DUST is only committed once the transaction is going out.
 */
export const submitHeldAttestation = async (
  providers: NightSealProviders,
  held: UnboundTransaction,
): Promise<{ accepted: boolean; detail: string }> => {
  try {
    const finalized = await providers.walletProvider.balanceTx(held);
    const txHash = await providers.midnightProvider.submitTx(finalized);
    return { accepted: true, detail: txHash };
  } catch (err) {
    return { accepted: false, detail: explain(err) };
  }
};

export type PublicState = {
  baselineEpoch: bigint;
  approvedRoot: bigint;
  componentRoot: bigint;
  devices: {
    id: string;
    label: string;
    status: string;
    epoch: bigint | null;
    identityRegistered: boolean;
  }[];
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
    componentRoot: state.componentSet.root().field,
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
      return {
        id: device.id,
        label: device.label,
        status,
        epoch,
        identityRegistered: state.registeredDeviceKey.member(key),
      };
    }),
  };
};
