/**
 * NightSeal private state and witnesses.
 *
 * Everything in here stays on the device. The ledger never sees the firmware
 * measurement, the blinding randomness, or the Merkle path.
 */

import type { MerkleTreePath, WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from './managed/nightseal/contract/index.js';

export type NightSealPrivateState = {
  /** Identity key. For the registry operator this authorises baseline changes. */
  readonly secretKey: Uint8Array;
  /** The device's firmware measurement — the secret being proven about. */
  readonly measurement: Uint8Array;
  /** Blinding factor issued by the operator alongside the approval. */
  readonly randomness: Uint8Array;
  /**
   * Last Merkle path this device successfully attested with. Kept so the demo can
   * replay a stale proof against a new baseline and show it being rejected.
   */
  readonly lastPath?: MerkleTreePath<Uint8Array>;
};

export const createNightSealPrivateState = (
  secretKey: Uint8Array,
  measurement: Uint8Array,
  randomness: Uint8Array,
): NightSealPrivateState => ({ secretKey, measurement, randomness });

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, NightSealPrivateState>): [NightSealPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],

  firmwareMeasurement: ({
    privateState,
  }: WitnessContext<Ledger, NightSealPrivateState>): [NightSealPrivateState, Uint8Array] => [
    privateState,
    privateState.measurement,
  ],

  firmwareRandomness: ({
    privateState,
  }: WitnessContext<Ledger, NightSealPrivateState>): [NightSealPrivateState, Uint8Array] => [
    privateState,
    privateState.randomness,
  ],

  /**
   * Resolve this device's Merkle path from public ledger state.
   *
   * findPathForLeaf is TypeScript-only — it cannot be called inside a circuit, which
   * is why the path has to arrive as a witness. If the commitment is absent the
   * firmware has been revoked: there is no path, so no proof can be produced. That
   * failure is the whole point of the product, so the error message is user-facing.
   */
  firmwarePath: (
    { ledger, privateState }: WitnessContext<Ledger, NightSealPrivateState>,
    commitment: Uint8Array,
  ): [NightSealPrivateState, MerkleTreePath<Uint8Array>] => {
    const path = ledger.approvedSet.findPathForLeaf(commitment);
    if (path === undefined) {
      throw new Error(
        'This firmware is not in the current approved baseline — it was never approved, or it has been revoked.',
      );
    }
    return [{ ...privateState, lastPath: path }, path];
  },
};
