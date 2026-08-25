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
};

export type Device = {
  readonly id: string;
  readonly label: string;
  readonly buildId: string;
};

type Manifest = {
  builds: { id: string; version: string; measurementLabel: string; index: number; note: string }[];
  devices: { id: string; label: string; buildId: string }[];
};

const manifest = JSON.parse(
  readFileSync(new URL('../../fleet.json', import.meta.url), 'utf8'),
) as Manifest;

// measurementLabel is fixed in fleet.json rather than derived from the version string:
// these labels determine the on-chain commitments, so they must never drift.
export const BUILDS: readonly FirmwareBuild[] = manifest.builds.map((b) => ({
  id: b.id,
  version: b.version,
  index: BigInt(b.index),
  note: b.note,
  measurement: digest(`firmware:${b.measurementLabel}`),
  randomness: digest(`blinding:${b.measurementLabel}`),
}));

export const DEVICES: readonly Device[] = manifest.devices;

export const buildById = (id: string): FirmwareBuild => {
  const build = BUILDS.find((b) => b.id === id);
  if (!build) throw new Error(`Unknown firmware build: ${id}. Known: ${BUILDS.map((b) => b.id).join(', ')}`);
  return build;
};

export const deviceById = (id: string): Device => {
  const device = DEVICES.find((d) => d.id === id);
  if (!device) throw new Error(`Unknown device: ${id}. Known: ${DEVICES.map((d) => d.id).join(', ')}`);
  return device;
};

export const buildForDevice = (device: Device): FirmwareBuild => buildById(device.buildId);

/** 32-byte on-chain device identifier. */
export const deviceKey = (device: Pick<Device, 'id'>): Uint8Array => digest(`device:${device.id}`);
