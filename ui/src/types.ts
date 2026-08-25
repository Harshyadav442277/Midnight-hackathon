export type DeviceStatus = 'COMPLIANT' | 'RE-ATTESTATION REQUIRED' | 'NEVER ATTESTED';

/**
 * Outcome of the last attestation attempt, reported by the operator service.
 * Not ledger state — a rejected proof writes nothing on-chain.
 */
export type Attempt = { ok: boolean; error?: string; at: string; epoch: string };

export type DeviceView = {
  id: string;
  label: string;
  status: DeviceStatus;
  epoch: string | null;
  lastAttempt: Attempt | null;
};

export type BuildView = {
  id: string;
  version: string;
  index: string;
  note: string;
};

export type RegistryState = {
  /** True on the public auditor deployment, which holds no operator key. */
  readOnly?: boolean;
  baselineEpoch: string;
  approvedRoot: string;
  contractAddress: string;
  explorer: string;
  explorerBase: string;
  network: string;
  devices: DeviceView[];
  builds: BuildView[];
  fleet: { id: string; label: string; buildId: string }[];
};

export type ActionResult = {
  ok: boolean;
  txHash?: string;
  explorer?: string;
  error?: string;
};
