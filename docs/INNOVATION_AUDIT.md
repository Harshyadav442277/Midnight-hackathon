# NightSeal innovation audit

This audit asks one question of every candidate: **what security or privacy property
becomes possible that was impossible before?** Scores are 1–5; for implementation
risk, 5 is worst.

| Rank | Candidate | New property that was previously impossible | Novelty | Midnight necessity | Demo impact | Implementation risk |
|---:|---|---|---:|---:|---:|---:|
| 1 | Cascading private component revocation | A component CVE can invalidate every affected firmware capability without publishing the affected builds or their component graph. | 5 | 5 | 5 | 3 |
| 2 | Device-bound ZK attestation | Knowledge of an approved firmware opening is no longer enough: the prover must also know the registered secret for the named device, so Device A cannot authorize Device B. | 3 | 4 | 4 | 2 |
| 3 | Operation-hiding policy updates | Approval, revocation, and cover rotation have the same public circuit and opaque argument shape, so the chain enforces changed capabilities without revealing which kind of policy event occurred. | 5 | 5 | 4 | 2 |
| 4 | Fleet-level private threshold proof | An auditor can learn that a fleet clears a compliance threshold without learning any individual device result—but only after per-device status is made confidential. | 5 | 5 | 4 | 5 |
| 5 | Private security-generation / lineage predicate | A device can prove `securityGeneration >= policyMinimum` and an approved lineage while hiding the exact version. | 3 | 4 | 3 | 3 |
| 6 | Epoch nullifier / one-proof-per-epoch rule | A valid attestation cannot be submitted twice in one epoch, even when the root has not changed. | 3 | 4 | 3 | 3 |
| 7 | Rotating unlinkable device identities | The same registered device can attest across epochs without exposing a stable public identifier that lets observers link its history. | 4 | 5 | 3 | 4 |

## Selection

### Flagship — cascading private component revocation

Each approved firmware leaf is a commitment to both its private firmware measurement
and a private, fixed-width component-manifest digest. Every component in that manifest
must separately open a leaf in the **current** approved-component Merkle tree.

The attestation therefore proves both statements atomically:

1. this hidden firmware build is currently approved; and
2. every hidden component bound into that build is currently approved.

Revoking a component replaces its component-tree leaf with the default value. The
component root and policy epoch move, so a firmware image containing that component
loses the ability to satisfy the circuit. The firmware leaf itself is not removed and
the public chain never learns which firmware capabilities depended on the component.
This is a cryptographic cascade, not a backend lookup.

The hackathon implementation uses exactly three component slots per firmware image so
the circuit remains static and deployment-safe. Production deployments can choose a
larger fixed width or bind a private component Merkle root and prove bounded paths.

### Secondary — registered device proof-of-possession

The operator registers `deviceId -> H(deviceSecret)` on-chain. `attest(deviceId)` now
proves knowledge of the corresponding secret inside the same ZK circuit as both
Merkle-membership checks. A copied firmware opening or Merkle path cannot be used to
write compliance for another registered device.

This is an application-level device identity binding, not a claim of real measured
boot. The simulator supplies the secret; a production platform would protect it with
its TPM or secure element.

### Optional stretch — operation-hiding policy updates (implemented)

Firmware approvals and revocations both call `updateFirmwareLeaf(value, index)`;
component approvals and revocations both call `updateComponentLeaf(value, index)`.
Approval writes a real capability commitment. Revocation writes fresh random bytes—a
tombstone for which nobody knows a valid opening. Routine cover rotation can use the
same operation. All three cases move a root and epoch through the same public circuit
and argument shape, so an observer learns that policy changed but not whether the
event approved, revoked, or merely rotated a leaf.

Per-device status dynamics can still leak correlation after a real revocation; this
mechanism hides operation type, not all timing metadata.

## Rejected as primary mechanisms

- **Private version predicates** are useful policy sugar, but a private approved-set
  capability already expresses arbitrary operator policy. They become distinctive only
  when multiple versions share a lineage and auditors need a numeric guarantee.
- **Epoch nullifiers** stop same-epoch duplicate submissions, but duplicates do not grant
  a new capability. The current-root checks already reject proofs after any revocation.
- **Rotating identities** improve unlinkability but conflict with the MVP's explicit
  per-device public dashboard and substantially widen the product story.
- **Fleet threshold proof** is post-hackathon: while per-device statuses are public, the
  aggregate is already computable and ZK adds no property. It becomes meaningful only
  after redesigning the status model as confidential and adding anti-double-counting.
- AI, tokens, NFTs, IPFS, extra chains, MPC, TEEs, and post-quantum branding add no
  property needed by this threat model and are excluded.
