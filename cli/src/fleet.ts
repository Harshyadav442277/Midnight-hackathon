/**
 * The demo fleet.
 *
 * A leaf in the approved set is one *firmware build*, not one device — every device
 * running that build shares the commitment and the blinding factor the operator
 * issued with it. That is what makes revocation realistic: one CVE, one revoked
 * leaf, and every device on that build stops being able to attest.
 */

import { createHash } from 'node:crypto';

export const digest = (label: string): Uint8Array =>
  new Uint8Array(createHash('sha256').update(label).digest());

export const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

export type FirmwareBuild = {
  readonly id: string;
  readonly version: string;
  /** The secret measurement. Never leaves the device. */
  readonly measurement: Uint8Array;
  /** Blinding factor issued by the operator with the approval. */
  readonly randomness: Uint8Array;
  /** Leaf index in the approved-set Merkle tree. */
  readonly index: bigint;
  readonly note: string;
};

export type Device = {
  readonly id: string;
  readonly label: string;
  readonly buildId: string;
};

export const BUILDS: readonly FirmwareBuild[] = [
  {
    id: 'rtr-2.4.1',
    version: 'router-fw 2.4.1',
    measurement: digest('firmware:router-fw-2.4.1'),
    randomness: digest('blinding:router-fw-2.4.1'),
    index: 0n,
    note: 'Current hardened build.',
  },
  {
    id: 'rtr-2.3.9',
    version: 'router-fw 2.3.9',
    measurement: digest('firmware:router-fw-2.3.9'),
    randomness: digest('blinding:router-fw-2.3.9'),
    index: 1n,
    note: 'The build a CVE lands on during the demo.',
  },
];

export const DEVICES: readonly Device[] = [
  { id: 'router-fleet-07', label: 'Router · fleet-07', buildId: 'rtr-2.3.9' },
  { id: 'sensor-gateway-02', label: 'Sensor gateway · 02', buildId: 'rtr-2.4.1' },
  { id: 'edge-cam-11', label: 'Edge camera · 11', buildId: 'rtr-2.4.1' },
];

export const buildById = (id: string): FirmwareBuild => {
  const build = BUILDS.find((b) => b.id === id);
  if (!build) throw new Error(`Unknown firmware build: ${id}`);
  return build;
};

export const deviceById = (id: string): Device => {
  const device = DEVICES.find((d) => d.id === id);
  if (!device) throw new Error(`Unknown device: ${id}. Known: ${DEVICES.map((d) => d.id).join(', ')}`);
  return device;
};

export const buildForDevice = (device: Device): FirmwareBuild => buildById(device.buildId);

/** 32-byte on-chain device identifier. */
export const deviceKey = (device: Device): Uint8Array => digest(`device:${device.id}`);
