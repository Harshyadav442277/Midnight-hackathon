/**
 * The demo fleet.
 *
 * Public metadata lives in fleet.json at the repo root, shared with the public auditor
 * endpoint. The secrets — firmware measurements and blinding factors — are derived
 * here from the build id and never stored anywhere.
 *
 * A leaf in the approved set is one *firmware build*, not one device: every device
 * running that build shares the commitment the operator issued for it. That is what
 * makes revocation realistic — one CVE, one revoked leaf, and every device on that
 * build stops being able to attest.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const digest = (label: string): Uint8Array =>
  new Uint8Array(createHash('sha256').update(label).digest());

export const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

export type FirmwareBuild = {
  readonly id: string;
  readonly version: string;
  readonly measurement: Uint8Array;
  readonly randomness: Uint8Array;
  readonly index: bigint;
  readonly note: string;
  readonly componentIds: readonly [string, string, string];
};

export type Component = {
  readonly id: string;
  readonly label: string;
  readonly measurement: Uint8Array;
  readonly randomness: Uint8Array;
  readonly index: bigint;
  readonly note: string;
};

export type Device = {
  readonly id: string;
  readonly label: string;
  readonly buildId: string;
};

type Manifest = {
  components: {
    id: string;
    label: string;
    measurementLabel: string;
    index: number;
    note: string;
  }[];
  builds: {
    id: string;
    version: string;
    measurementLabel: string;
    index: number;
    note: string;
    componentIds: [string, string, string];
  }[];
  devices: { id: string; label: string; buildId: string }[];
};

const manifest = JSON.parse(
  readFileSync(new URL('../../fleet.json', import.meta.url), 'utf8'),
) as Manifest;

// measurementLabel is fixed in fleet.json rather than derived from the version string:
// these labels determine the on-chain commitments, so they must never drift.
export const COMPONENTS: readonly Component[] = manifest.components.map((c) => ({
  id: c.id,
  label: c.label,
  index: BigInt(c.index),
  note: c.note,
  measurement: digest(`component:${c.measurementLabel}`),
  randomness: digest(`component-blinding:${c.measurementLabel}`),
}));

export const BUILDS: readonly FirmwareBuild[] = manifest.builds.map((b) => ({
  id: b.id,
  version: b.version,
  index: BigInt(b.index),
  note: b.note,
  measurement: digest(`firmware:${b.measurementLabel}`),
  randomness: digest(`blinding:${b.measurementLabel}`),
  componentIds: b.componentIds,
}));

export const DEVICES: readonly Device[] = manifest.devices;

export const buildById = (id: string): FirmwareBuild => {
  const build = BUILDS.find((b) => b.id === id);
  if (!build) throw new Error(`Unknown firmware build: ${id}. Known: ${BUILDS.map((b) => b.id).join(', ')}`);
  return build;
};

export const componentById = (id: string): Component => {
  const component = COMPONENTS.find((c) => c.id === id);
  if (!component) {
    throw new Error(`Unknown component: ${id}. Known: ${COMPONENTS.map((c) => c.id).join(', ')}`);
  }
  return component;
};

export const deviceById = (id: string): Device => {
  const device = DEVICES.find((d) => d.id === id);
  if (!device) throw new Error(`Unknown device: ${id}. Known: ${DEVICES.map((d) => d.id).join(', ')}`);
  return device;
};

export const buildForDevice = (device: Device): FirmwareBuild => buildById(device.buildId);

export const componentsForBuild = (
  build: FirmwareBuild,
): readonly [Component, Component, Component] => [
  componentById(build.componentIds[0]),
  componentById(build.componentIds[1]),
  componentById(build.componentIds[2]),
];

/** 32-byte on-chain device identifier. */
export const deviceKey = (device: Pick<Device, 'id'>): Uint8Array => digest(`device:${device.id}`);

/**
 * Private device-secret opening used by the simulator's registered identity proof.
 * The provisioning seed is secret (.env), so this cannot be derived from the public id.
 * Production devices would generate and protect this value inside a TPM/secure element.
 */
export const deviceSecret = (
  device: Pick<Device, 'id'>,
  provisioningSeed: string,
): Uint8Array => digest(`device-secret:${device.id}:${provisioningSeed}`);
