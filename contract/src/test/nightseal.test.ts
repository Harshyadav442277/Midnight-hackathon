/**
 * The NightSeal lifecycle, end to end, in one file.
 *
 * These tests are the product claim: a device with approved firmware can prove
 * compliance without revealing the firmware, and the moment the operator revokes
 * that firmware the device can no longer produce a passing attestation — while an
 * unaffected device still can.
 */

import { describe, expect, it } from 'vitest';

import { NightSealSimulator } from './nightseal-simulator.js';
import { bytes32, toHex } from './utils.js';
import { createNightSealPrivateState, type NightSealPrivateState } from '../witnesses.js';

const OPERATOR_KEY = bytes32('operator-secret');
const ROGUE_KEY = bytes32('rogue-operator-secret');

// Two devices running two different approved firmware builds.
const CLEAN = {
  deviceId: bytes32('device:sensor-gateway-02'),
  measurement: bytes32('firmware:v2.4.1-clean'),
  randomness: bytes32('rand:clean'),
  index: 0n,
};
const VULNERABLE = {
  deviceId: bytes32('device:router-fleet-07'),
  measurement: bytes32('firmware:v2.3.9-cve-2026-11xx'),
  randomness: bytes32('rand:vulnerable'),
  index: 1n,
};

const operatorState = (): NightSealPrivateState =>
  createNightSealPrivateState(OPERATOR_KEY, bytes32('unused'), bytes32('unused'));

const deviceState = (d: typeof CLEAN): NightSealPrivateState =>
  createNightSealPrivateState(bytes32('device-key'), d.measurement, d.randomness);

/** Operator deploys and approves both firmware builds. */
const bootstrapRegistry = () => {
  const sim = new NightSealSimulator(operatorState());
  for (const d of [CLEAN, VULNERABLE]) {
    const commitment = sim.commitmentFor(d.measurement, d.randomness);
    sim.approveFirmware(commitment, d.index);
  }
  return sim;
};

describe('NightSeal registry', () => {
  it('records the deploying operator and starts at baseline epoch 1', () => {
    const sim = new NightSealSimulator(operatorState());
    const ledger = sim.getLedger();

    expect(ledger.baselineEpoch).toEqual(1n);
    expect(ledger.operatorPk).toHaveLength(32);
  });

  it('bumps the baseline epoch and changes the approved-set root on approval', () => {
    const sim = new NightSealSimulator(operatorState());
    const rootBefore = sim.getLedger().approvedSet.root().field;

    const commitment = sim.commitmentFor(CLEAN.measurement, CLEAN.randomness);
    const ledger = sim.approveFirmware(commitment, CLEAN.index);

    expect(ledger.baselineEpoch).toEqual(2n);
    expect(ledger.approvedSet.root().field).not.toEqual(rootBefore);
  });

  it('refuses baseline changes from anyone but the registry operator', () => {
    const sim = bootstrapRegistry();
    const commitment = sim.commitmentFor(bytes32('firmware:rogue'), bytes32('rand:rogue'));

    sim.as(createNightSealPrivateState(ROGUE_KEY, bytes32('x'), bytes32('x')));

    expect(() => sim.approveFirmware(commitment, 5n)).toThrow(/not the registry operator/);
    expect(() => sim.revokeFirmware(VULNERABLE.index)).toThrow(/not the registry operator/);
  });
});

describe('attestation', () => {
  it('marks an approved device compliant at the current baseline epoch', () => {
    const sim = bootstrapRegistry();
    sim.as(deviceState(CLEAN));

    const ledger = sim.attest(CLEAN.deviceId);

    expect(ledger.deviceStatus.lookup(CLEAN.deviceId)).toEqual(1); // Status.COMPLIANT
    expect(ledger.deviceEpoch.lookup(CLEAN.deviceId)).toEqual(ledger.baselineEpoch);
  });

  it('never writes the firmware measurement to the ledger', () => {
    const sim = bootstrapRegistry();
    sim.as(deviceState(CLEAN));
    sim.attest(CLEAN.deviceId);

    const published = JSON.stringify(sim.getLedger(), (_k, v) =>
      v instanceof Uint8Array ? toHex(v) : typeof v === 'bigint' ? v.toString() : v,
    );

    expect(published).not.toContain(toHex(CLEAN.measurement));
    expect(published).not.toContain(toHex(CLEAN.randomness));
  });

  it('cannot attest for firmware that was never approved', () => {
    const sim = bootstrapRegistry();
    sim.as(
      createNightSealPrivateState(
        bytes32('device-key'),
        bytes32('firmware:never-approved'),
        bytes32('rand:unknown'),
      ),
    );

    expect(() => sim.attest(bytes32('device:counterfeit'))).toThrow(
      /not in the current approved baseline/,
    );
  });
});

describe('revocation — the CVE moment', () => {
  it('stops the affected device from re-attesting, while an unaffected device still can', () => {
    const sim = bootstrapRegistry();

    // Both devices attest successfully against the original baseline.
    sim.as(deviceState(CLEAN)).attest(CLEAN.deviceId);
    sim.as(deviceState(VULNERABLE)).attest(VULNERABLE.deviceId);

    const before = sim.getLedger();
    expect(before.deviceEpoch.lookup(CLEAN.deviceId)).toEqual(before.baselineEpoch);
    expect(before.deviceEpoch.lookup(VULNERABLE.deviceId)).toEqual(before.baselineEpoch);

    // A CVE lands: the operator revokes the vulnerable build.
    sim.as(operatorState());
    const after = sim.revokeFirmware(VULNERABLE.index);

    // Every device is now stale: attested epoch trails the baseline.
    expect(after.baselineEpoch).toBeGreaterThan(before.baselineEpoch);
    expect(after.deviceEpoch.lookup(CLEAN.deviceId)).toBeLessThan(after.baselineEpoch);
    expect(after.deviceEpoch.lookup(VULNERABLE.deviceId)).toBeLessThan(after.baselineEpoch);

    // The revoked device can no longer produce a passing attestation.
    sim.as(deviceState(VULNERABLE));
    expect(() => sim.attest(VULNERABLE.deviceId)).toThrow(/not in the current approved baseline/);

    // The unaffected device re-attests and returns to current.
    sim.as(deviceState(CLEAN));
    const healed = sim.attest(CLEAN.deviceId);
    expect(healed.deviceEpoch.lookup(CLEAN.deviceId)).toEqual(healed.baselineEpoch);
  });

  it('leaves the revoked device pinned to the stale epoch it last passed at', () => {
    const sim = bootstrapRegistry();
    sim.as(deviceState(VULNERABLE)).attest(VULNERABLE.deviceId);
    const epochWhenItPassed = sim.getLedger().deviceEpoch.lookup(VULNERABLE.deviceId);

    sim.as(operatorState()).revokeFirmware(VULNERABLE.index);
    sim.as(deviceState(VULNERABLE));
    expect(() => sim.attest(VULNERABLE.deviceId)).toThrow();

    const ledger = sim.getLedger();
    // Its last-known-good epoch is unchanged, and it is provably behind the baseline.
    expect(ledger.deviceEpoch.lookup(VULNERABLE.deviceId)).toEqual(epochWhenItPassed);
    expect(ledger.baselineEpoch).toBeGreaterThan(epochWhenItPassed);
  });

  it('invalidates the old approved-set root, so a replayed proof cannot match', () => {
    const sim = bootstrapRegistry();
    const rootBefore = sim.getLedger().approvedSet.root();

    sim.as(operatorState()).revokeFirmware(VULNERABLE.index);
    const rootAfter = sim.getLedger().approvedSet.root();

    // checkRoot on a plain MerkleTree accepts only the current root, so a proof
    // carrying rootBefore is rejected by the verifier after revocation.
    expect(rootAfter).not.toEqual(rootBefore);
    expect(sim.getLedger().approvedSet.checkRoot(rootBefore)).toBe(false);
  });
});
