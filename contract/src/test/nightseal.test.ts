/**
 * NightSeal's two cryptographic gates, exercised end to end:
 *
 * 1. a prover must control the registered device identity; and
 * 2. its hidden firmware plus every component bound into it must remain current.
 */

import { describe, expect, it } from 'vitest';

import { NightSealSimulator } from './nightseal-simulator.js';
import { bytes32, toHex } from './utils.js';
import {
  createNightSealPrivateState,
  type ComponentVector,
  type NightSealPrivateState,
} from '../witnesses.js';

const OPERATOR_KEY = bytes32('operator-secret');
const ROGUE_KEY = bytes32('rogue-operator-secret');

type ComponentFixture = {
  measurement: Uint8Array;
  randomness: Uint8Array;
  index: bigint;
};

type BuildFixture = {
  measurement: Uint8Array;
  randomness: Uint8Array;
  index: bigint;
  components: readonly [ComponentFixture, ComponentFixture, ComponentFixture];
};

type DeviceFixture = {
  deviceId: Uint8Array;
  secret: Uint8Array;
  build: BuildFixture;
};

const component = (label: string, index: bigint): ComponentFixture => ({
  measurement: bytes32(`component:${label}`),
  randomness: bytes32(`component-randomness:${label}`),
  index,
});

const BOOT = component('secure-boot-6', 0n);
const KERNEL = component('linux-lts-6.12', 1n);
const TLS_CLEAN = component('tls-3.4-hardened', 2n);
const TLS_VULNERABLE = component('tls-3.0-cve-2026-11xx', 3n);
const ALL_COMPONENTS = [BOOT, KERNEL, TLS_CLEAN, TLS_VULNERABLE] as const;

const CLEAN_BUILD: BuildFixture = {
  measurement: bytes32('firmware:v2.4.1-clean'),
  randomness: bytes32('firmware-randomness:clean'),
  index: 0n,
  components: [BOOT, KERNEL, TLS_CLEAN],
};

const VULNERABLE_BUILD: BuildFixture = {
  measurement: bytes32('firmware:v2.3.9-cve-2026-11xx'),
  randomness: bytes32('firmware-randomness:vulnerable'),
  index: 1n,
  components: [BOOT, KERNEL, TLS_VULNERABLE],
};

const CLEAN: DeviceFixture = {
  deviceId: bytes32('device:sensor-gateway-02'),
  secret: bytes32('device-secret:sensor-gateway-02'),
  build: CLEAN_BUILD,
};

const VULNERABLE: DeviceFixture = {
  deviceId: bytes32('device:router-fleet-07'),
  secret: bytes32('device-secret:router-fleet-07'),
  build: VULNERABLE_BUILD,
};

const UNUSED: ComponentVector = [bytes32('unused-0'), bytes32('unused-1'), bytes32('unused-2')];

const operatorState = (key = OPERATOR_KEY): NightSealPrivateState =>
  createNightSealPrivateState(key, bytes32('unused'), bytes32('unused'), UNUSED, UNUSED);

const values = (
  items: readonly [ComponentFixture, ComponentFixture, ComponentFixture],
  pick: (item: ComponentFixture) => Uint8Array,
): ComponentVector => [pick(items[0]), pick(items[1]), pick(items[2])];

const deviceState = (
  device: DeviceFixture,
  build: BuildFixture = device.build,
): NightSealPrivateState =>
  createNightSealPrivateState(
    device.secret,
    build.measurement,
    build.randomness,
    values(build.components, (c) => c.measurement),
    values(build.components, (c) => c.randomness),
  );

const componentCommitment = (
  sim: NightSealSimulator,
  item: ComponentFixture,
): Uint8Array => sim.componentCommitment(item.measurement, item.randomness);

const firmwareCommitment = (sim: NightSealSimulator, build: BuildFixture): Uint8Array => {
  const components: [Uint8Array, Uint8Array, Uint8Array] = [
    componentCommitment(sim, build.components[0]),
    componentCommitment(sim, build.components[1]),
    componentCommitment(sim, build.components[2]),
  ];
  return sim.commitmentFor(
    build.measurement,
    sim.componentManifest(components),
    build.randomness,
  );
};

/** Operator registers identities and publishes both current capability sets. */
const bootstrapRegistry = () => {
  const sim = new NightSealSimulator(operatorState());
  for (const item of ALL_COMPONENTS) {
    sim.approveComponent(componentCommitment(sim, item), item.index);
  }
  for (const build of [CLEAN_BUILD, VULNERABLE_BUILD]) {
    sim.approveFirmware(firmwareCommitment(sim, build), build.index);
  }
  for (const device of [CLEAN, VULNERABLE]) {
    sim.registerDevice(device.deviceId, sim.deviceIdentity(device.secret));
  }
  return sim;
};

describe('NightSeal registry', () => {
  it('starts with two independent current-only capability roots', () => {
    const sim = new NightSealSimulator(operatorState());
    const ledger = sim.getLedger();

    expect(ledger.baselineEpoch).toEqual(1n);
    expect(ledger.operatorPk).toHaveLength(32);
    expect(ledger.approvedSet.root()).toBeDefined();
    expect(ledger.componentSet.root()).toBeDefined();
  });

  it('moves the policy epoch and only the relevant root on approval', () => {
    const sim = new NightSealSimulator(operatorState());
    const before = sim.getLedger();
    const firmwareRoot = before.approvedSet.root().field;
    const componentRoot = before.componentSet.root().field;

    sim.approveComponent(componentCommitment(sim, BOOT), BOOT.index);
    const after = sim.getLedger();

    expect(after.baselineEpoch).toEqual(2n);
    expect(after.componentSet.root().field).not.toEqual(componentRoot);
    expect(after.approvedSet.root().field).toEqual(firmwareRoot);
  });

  it('refuses every policy or identity change from a non-operator', () => {
    const sim = bootstrapRegistry().as(operatorState(ROGUE_KEY));

    expect(() => sim.registerDevice(bytes32('rogue-device'), bytes32('rogue-id'))).toThrow(
      /not the registry operator/,
    );
    expect(() => sim.approveComponent(bytes32('rogue-component'), 9n)).toThrow(
      /not the registry operator/,
    );
    expect(() => sim.revokeComponent(TLS_VULNERABLE.index)).toThrow(/not the registry operator/);
    expect(() => sim.approveFirmware(bytes32('rogue-firmware'), 9n)).toThrow(
      /not the registry operator/,
    );
    expect(() => sim.revokeFirmware(VULNERABLE_BUILD.index)).toThrow(
      /not the registry operator/,
    );
  });
});

describe('device-bound attestation', () => {
  it('marks a registered device compliant at the current policy epoch', () => {
    const sim = bootstrapRegistry().as(deviceState(CLEAN));
    const ledger = sim.attest(CLEAN.deviceId);

    expect(ledger.deviceStatus.lookup(CLEAN.deviceId)).toEqual(1);
    expect(ledger.deviceEpoch.lookup(CLEAN.deviceId)).toEqual(ledger.baselineEpoch);
  });

  it("does not let Device A's valid firmware proof authorize Device B", () => {
    const sim = bootstrapRegistry().as(deviceState(CLEAN));

    expect(() => sim.attest(VULNERABLE.deviceId)).toThrow(
      /secret does not match the registered device/,
    );
    expect(() => sim.attest(bytes32('device:unregistered'))).toThrow(/device is not registered/);
  });

  it('publishes neither identity secret, firmware, components, nor openings', () => {
    const sim = bootstrapRegistry().as(deviceState(CLEAN));
    sim.attest(CLEAN.deviceId);

    const published = JSON.stringify(sim.getLedger(), (_key, value) =>
      value instanceof Uint8Array
        ? toHex(value)
        : typeof value === 'bigint'
          ? value.toString()
          : value,
    );

    for (const secret of [
      CLEAN.secret,
      CLEAN_BUILD.measurement,
      CLEAN_BUILD.randomness,
      ...CLEAN_BUILD.components.flatMap((c) => [c.measurement, c.randomness]),
    ]) {
      expect(published).not.toContain(toHex(secret));
    }
  });

  it('cannot attest a firmware capability that was never approved', () => {
    const sim = bootstrapRegistry();
    const unknown = {
      ...CLEAN_BUILD,
      measurement: bytes32('firmware:never-approved'),
      randomness: bytes32('firmware-randomness:unknown'),
    };

    sim.as(deviceState(CLEAN, unknown));
    expect(() => sim.attest(CLEAN.deviceId)).toThrow(/not in the current approved baseline/);
  });

  it('cannot swap in a clean component because the manifest is firmware-bound', () => {
    const sim = bootstrapRegistry();
    const substituted = { ...VULNERABLE_BUILD, components: CLEAN_BUILD.components };

    sim.as(deviceState(VULNERABLE, substituted));
    expect(() => sim.attest(VULNERABLE.deviceId)).toThrow(/not in the current approved baseline/);
  });
});

describe('cascading private component revocation — the CVE moment', () => {
  it('invalidates only dependent firmware without removing or identifying its firmware leaf', () => {
    const sim = bootstrapRegistry();
    sim.as(deviceState(CLEAN)).attest(CLEAN.deviceId);
    sim.as(deviceState(VULNERABLE)).attest(VULNERABLE.deviceId);

    const before = sim.getLedger();
    const firmwareRootBefore = before.approvedSet.root();
    const componentRootBefore = before.componentSet.root();
    const vulnerableFirmwareLeaf = firmwareCommitment(sim, VULNERABLE_BUILD);

    const after = sim.as(operatorState()).revokeComponent(TLS_VULNERABLE.index);

    expect(after.approvedSet.root()).toEqual(firmwareRootBefore);
    expect(after.componentSet.root()).not.toEqual(componentRootBefore);
    expect(after.approvedSet.findPathForLeaf(vulnerableFirmwareLeaf)).toBeDefined();
    expect(after.deviceEpoch.lookup(CLEAN.deviceId)).toBeLessThan(after.baselineEpoch);
    expect(after.deviceEpoch.lookup(VULNERABLE.deviceId)).toBeLessThan(after.baselineEpoch);

    sim.as(deviceState(VULNERABLE));
    expect(() => sim.attest(VULNERABLE.deviceId)).toThrow(/component.*current approved/i);

    sim.as(deviceState(CLEAN));
    const healed = sim.attest(CLEAN.deviceId);
    expect(healed.deviceEpoch.lookup(CLEAN.deviceId)).toEqual(healed.baselineEpoch);
  });

  it('invalidates the previous component root, so pre-CVE proofs cannot replay', () => {
    const sim = bootstrapRegistry();
    const oldRoot = sim.getLedger().componentSet.root();

    sim.as(operatorState()).revokeComponent(TLS_VULNERABLE.index);

    expect(sim.getLedger().componentSet.checkRoot(oldRoot)).toBe(false);
  });
});

describe('operation-hiding policy updates', () => {
  /**
   * Approval and revocation are literally the same circuit call: one 32-byte opaque value
   * written at an index. Revocation just writes a value nobody knows an opening for. An
   * observer sees a leaf update either way — never which kind it was.
   */
  it('gives an approval and a revocation the same public shape', () => {
    const index = 5n;
    const genuine = bootstrapRegistry();
    const tombstoned = bootstrapRegistry();

    const capability = componentCommitment(genuine, component('newly-approved', index));
    const tombstone = bytes32('tombstone-with-no-known-opening');

    // Same simulator method for both — it is the same circuit underneath.
    genuine.approveComponent(capability, index);
    tombstoned.approveComponent(tombstone, index);

    const a = genuine.getLedger();
    const t = tombstoned.getLedger();

    // Identical epoch movement, and a well-formed leaf sits at the index in both cases.
    expect(t.baselineEpoch).toEqual(a.baselineEpoch);
    expect(a.componentSet.findPathForLeaf(capability)).toBeDefined();
    expect(t.componentSet.findPathForLeaf(tombstone)).toBeDefined();

    // The roots differ — that much is public and expected — but nothing in published state
    // labels either write as an approval or a removal.
    const published = JSON.stringify(t, (_key, value) =>
      value instanceof Uint8Array ? toHex(value) : typeof value === 'bigint' ? value.toString() : value,
    );
    expect(published).not.toMatch(/revoke|tombstone|removed|disabled/i);
  });

  it('leaves a revoked component unopenable, so no proof can use it', () => {
    const sim = bootstrapRegistry();
    sim.revokeComponent(TLS_VULNERABLE.index);

    // The old capability commitment is gone from the tree; only the opaque tombstone remains.
    expect(
      sim.getLedger().componentSet.findPathForLeaf(componentCommitment(sim, TLS_VULNERABLE)),
    ).toBeUndefined();
  });
});

describe('direct firmware revocation remains available', () => {
  it('preserves the original PASS → REVOKE → FAIL mechanism', () => {
    const sim = bootstrapRegistry().as(deviceState(VULNERABLE));
    sim.attest(VULNERABLE.deviceId);
    const rootBefore = sim.getLedger().approvedSet.root();

    sim.as(operatorState()).revokeFirmware(VULNERABLE_BUILD.index);

    expect(sim.getLedger().approvedSet.checkRoot(rootBefore)).toBe(false);
    sim.as(deviceState(VULNERABLE));
    expect(() => sim.attest(VULNERABLE.deviceId)).toThrow(/not in the current approved baseline/);
  });
});
