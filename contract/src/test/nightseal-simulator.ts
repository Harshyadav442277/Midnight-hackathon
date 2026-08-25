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

  public getPrivateState(): NightSealPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /** Commitment the contract would compute for this device's firmware. */
  public commitmentFor(measurement: Uint8Array, randomness: Uint8Array): Uint8Array {
    return this.contract.circuits.firmwareCommitment(
      this.circuitContext,
      measurement,
      randomness,
    ).result;
  }

  public approveFirmware(commitment: Uint8Array, index: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.approveFirmware(
      this.circuitContext,
      commitment,
      index,
    ).context;
    return this.getLedger();
  }

  public revokeFirmware(index: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.revokeFirmware(
      this.circuitContext,
      index,
    ).context;
    return this.getLedger();
  }

  public attest(deviceId: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.attest(this.circuitContext, deviceId).context;
    return this.getLedger();
  }
}
