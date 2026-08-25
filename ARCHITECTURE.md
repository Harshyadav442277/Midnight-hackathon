# ARCHITECTURE — NightSeal

All code must conform to this document. If a change requires deviating, update this file first.

## Components
```
[device simulator / attest panel]        [operator panel]         [auditor dashboard]
        |  private firmware hash               | new root                 | reads only
        v                                      v                          v
   [proof server (local docker)] ---> [Midnight network (Preview/PreProd)] <--- [indexer]
        ZK proof generated locally      contract: NightSeal                 public state only
```
- **Root of trust boundary:** the device's firmware hash is supplied by a simulator script. Real systems obtain it from measured boot + TPM (NIST SP 800-193, TCG remote attestation). That layer is **out of scope — platform responsibility**. Our contribution is the privacy-preserving transparency layer above it. (Disclosed loudly, once, everywhere it matters.)

## Public / Private / Provable
| | |
|---|---|
| **Public on-chain** | device ID → compliance status (+ attested root epoch), current approved-set Merkle root, root-update history/epoch counter |
| **Private, never on-chain** | firmware hashes, SBOM/HBOM, versions, supplier list, Merkle path |
| **Provable** | "this device's firmware hash is a member of the current approved set" |

## Contract state (Compact ledger) — refine against verified stdlib docs before coding
- `approvedRoot` — current approved-set Merkle root (updated by operator; epoch increments).
- `epoch: Counter` — increments on every root update; attestation records the epoch it proved against.
- `deviceStatus: Map<DeviceId, { status, epoch }>` — public per-device compliance.
- `operator` — public key/address allowed to update the root (set in constructor).

## Circuit responsibilities
- **ONE circuit `attest`:** private witness = firmware hash + Merkle path. Circuit computes path→root, asserts it equals the **current** `approvedRoot` (read from ledger), then writes `deviceStatus[deviceId] = (COMPLIANT, currentEpoch)`. Device ID is public input.
- **`updateRoot` (admin, no ZK secret):** operator-only; sets new `approvedRoot`, bumps epoch.
- Replay defense: proof binds to the ledger's current root at proof time; after a root update the old proof cannot validate against the new root (and status epoch reveals staleness).

## Locked decisions (from BUILD_BRIEF §3 — do not reopen)
1. Membership proof via Compact stdlib Merkle primitives (`MerkleTree`/`HistoricMerkleTree`, `merkleTreePathRoot`). No custom crypto.
   - *Rejected:* custom accumulator / hand-rolled hashing — needless risk, zero rubric value.
2. Revocation = republish updated root. **No ZK non-membership proofs.**
   - *Rejected:* non-membership circuits — textbook-wrong complexity for this design.
3. Root of trust mocked + disclosed once, loudly (see boundary above).
   - *Rejected:* pretending to real attestation — discovered fakery kills the submission.
4. "Beyond the tutorials" README section pre-empts ZK Loan comparison: NightSeal = *stateful revocable baseline with on-chain lifecycle*, not one-shot attestation. Link the real root-update tx.
5. Verify all Compact/tooling facts against live docs before writing code.

## Decision log (running — add entries with rationale + rejected alternatives)
- 2026-08-25: repo lives on user's GitHub `Harshyadav442277/Midnight-hackathon`; Windows host, toolchain via Docker/WSL if native misbehaves (brief §8).
- (pending research) exact MerkleTree ADT choice — `MerkleTree` vs `HistoricMerkleTree`: intend **plain `MerkleTree`** so old roots are NOT accepted after update (revocation must invalidate old proofs — that IS the feature). Confirm semantics against stdlib docs before locking.
