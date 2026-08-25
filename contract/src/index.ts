import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

export * from './managed/nightseal/contract/index.js';
export * from './witnesses.js';

import * as Compiled from './managed/nightseal/contract/index.js';
import * as Witnesses from './witnesses.js';

/** Circuits callable from TypeScript via `contract.callTx.<name>(...)`. */
export type NightSealCircuits =
  | 'registerDevice'
  | 'updateFirmwareLeaf'
  | 'updateComponentLeaf'
  | 'attest';

export const NightSealContract = CompiledContract.make<
  Compiled.Contract<Witnesses.NightSealPrivateState>
>('NightSeal', Compiled.Contract<Witnesses.NightSealPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets('./managed/nightseal'),
);
