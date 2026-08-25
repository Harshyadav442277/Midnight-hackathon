import { createHash } from 'node:crypto';

/** Deterministic 32-byte value derived from a label, so tests read clearly. */
export const bytes32 = (label: string): Uint8Array =>
  new Uint8Array(createHash('sha256').update(label).digest());

export const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
