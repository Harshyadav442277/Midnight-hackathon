/**
 * In-memory testbed for the NightSeal contract. Runs circuits against a local
 * ledger so the full attestation lifecycle can be exercised without a network.
 */

import {
  type CircuitContext,
  CostModel,
  QueryContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';

import { Contract, type Ledger, ledger } from '../managed/nightseal/contract/index.js';
import { type NightSealPrivateState, witnesses } from '../witnesses.js';

export class NightSealSimulator {
  readonly contract: Contract<NightSealPrivateState>;
  circuitContext: CircuitContext<NightSealPrivateState>;

  constructor(initialPrivateState: NightSealPrivateState) {
    this.contract = new Contract<NightSealPrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(createConstructorContext(initialPrivateState, '0'.repeat(64)));

    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(currentContractState.data, sampleContractAddress()),
    };
  }

  /** Swap in another actor's private state (operator vs. a given device). */
  public as(privateState: NightSealPrivateState): this {
    this.circuitContext = { ...this.circuitContext, currentPrivateState: privateState };
    return this;
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public componentCommitment(measurement: Uint8Array, randomness: Uint8Array): Uint8Array {
    return this.contract.circuits.componentCommitment(
      this.circuitContext,
      measurement,
      randomness,
    ).result;
  }

  public deviceIdentity(secretKey: Uint8Array): Uint8Array {
    return this.contract.circuits.deviceIdentity(this.circuitContext, secretKey).result;
  }

  public componentManifest(components: [Uint8Array, Uint8Array, Uint8Array]): Uint8Array {
    return this.contract.circuits.componentManifest(this.circuitContext, components).result;
  }

  /** Commitment the contract would compute for this device's firmware capability. */
  public commitmentFor(
    measurement: Uint8Array,
    manifest: Uint8Array,
    randomness: Uint8Array,
  ): Uint8Array {
    return this.contract.circuits.firmwareCommitment(
      this.circuitContext,
      measurement,
      manifest,
      randomness,
    ).result;
  }

  public registerDevice(deviceId: Uint8Array, identity: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.registerDevice(
      this.circuitContext,
      deviceId,
      identity,
    ).context;
    return this.getLedger();
  }

  public approveFirmware(commitment: Uint8Array, index: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.updateFirmwareLeaf(
      this.circuitContext,
      commitment,
      index,
    ).context;
    return this.getLedger();
  }

  public approveComponent(commitment: Uint8Array, index: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.updateComponentLeaf(
      this.circuitContext,
      commitment,
      index,
    ).context;
    return this.getLedger();
  }

  public revokeFirmware(index: bigint): Ledger {
    const tombstone = new Uint8Array(32).fill(0xf1);
    tombstone[31] = Number(index % 251n);
    this.circuitContext = this.contract.impureCircuits.updateFirmwareLeaf(
      this.circuitContext,
      tombstone,
      index,
    ).context;
    return this.getLedger();
  }

  public revokeComponent(index: bigint): Ledger {
    const tombstone = new Uint8Array(32).fill(0xc1);
    tombstone[31] = Number(index % 251n);
    this.circuitContext = this.contract.impureCircuits.updateComponentLeaf(
      this.circuitContext,
      tombstone,
      index,
    ).context;
    return this.getLedger();
  }

  public attest(deviceId: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.attest(this.circuitContext, deviceId).context;
    return this.getLedger();
  }
}
