import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum Status { UNKNOWN = 0, COMPLIANT = 1 }

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  firmwareMeasurement(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  firmwareRandomness(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  firmwarePath(context: __compactRuntime.WitnessContext<Ledger, PS>,
               commitment_0: Uint8Array): [PS, { leaf: Uint8Array,
                                                 path: { sibling: { field: bigint
                                                                  },
                                                         goes_left: boolean
                                                       }[]
                                               }];
}

export type ImpureCircuits<PS> = {
  approveFirmware(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array,
                  index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  revokeFirmware(context: __compactRuntime.CircuitContext<PS>, index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  attest(context: __compactRuntime.CircuitContext<PS>, deviceId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  approveFirmware(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array,
                  index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  revokeFirmware(context: __compactRuntime.CircuitContext<PS>, index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  attest(context: __compactRuntime.CircuitContext<PS>, deviceId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  operatorIdentity(sk_0: Uint8Array): Uint8Array;
  firmwareCommitment(measurement_0: Uint8Array, randomness_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  operatorIdentity(context: __compactRuntime.CircuitContext<PS>,
                   sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  firmwareCommitment(context: __compactRuntime.CircuitContext<PS>,
                     measurement_0: Uint8Array,
                     randomness_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  approveFirmware(context: __compactRuntime.CircuitContext<PS>,
                  commitment_0: Uint8Array,
                  index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  revokeFirmware(context: __compactRuntime.CircuitContext<PS>, index_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  attest(context: __compactRuntime.CircuitContext<PS>, deviceId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  approvedSet: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined
  };
  readonly baselineEpoch: bigint;
  deviceStatus: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Status;
    [Symbol.iterator](): Iterator<[Uint8Array, Status]>
  };
  deviceEpoch: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  readonly operatorPk: Uint8Array;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
