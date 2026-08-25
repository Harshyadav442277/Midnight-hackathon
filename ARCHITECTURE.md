# ARCHITECTURE — NightSeal

All code must conform to this document. If a change requires deviating, update this file first.

## Components
```
[device simulator / attest panel]        [operator panel]         [auditor dashboard]
        |  private firmware hash               | approve/revoke           | reads only
        v                                      v                          v
   [proof server (local docker)] ---> [Midnight Preview network] <--- [indexer]
        ZK proof generated locally      contract: NightSeal            public state only
```
- **Root of trust boundary:** the device's firmware hash is supplied by a simulator script. Real systems obtain it from measured boot + TPM (NIST SP 800-193, TCG remote attestation). That layer is **out of scope — platform responsibility**. Our contribution is the privacy-preserving transparency layer above it.

## Public / Private / Provable
| | |
|---|---|
| **Public on-chain** | device ID → compliance status, attested baseline epoch, current approved-set Merkle root, opaque firmware *commitments*, epoch history |
| **Private, never on-chain** | firmware hashes, commitment randomness, Merkle paths, SBOM/versions/suppliers |
| **Provable** | "I know a firmware hash whose commitment is a leaf of the *current* approved-set root" |

## Where the build environment lives (decision 2026-08-25)
The Compact compiler ships **no Windows binary** (installer exits with "there isn't a download for your platform"). Docs support Linux/macOS only; Windows via WSL.
- Canonical working tree: **WSL Ubuntu 26.04 at `/root/nightseal`**, reachable from Windows as `\\wsl.localhost\Ubuntu\root\nightseal`.
- *Rejected:* building in the OneDrive folder via `/mnt/c` — cross-filesystem npm installs are slow and OneDrive would sync `node_modules`.
- GitHub (`Harshyadav442277/Midnight-hackathon`) is the durable artifact; push often, since the work lives on a WSL disk.
- Proof server runs in Docker; WSL must reach it at `localhost:6300` (verify; else run the container from inside WSL via Docker integration).

## Contract state (Compact ledger)
```
export enum Status { UNKNOWN, COMPLIANT }
export ledger approvedSet:   MerkleTree<10, Bytes<32>>;  // leaves = firmware COMMITMENTS
export ledger baselineEpoch: Counter;                    // bumped on every baseline change
export ledger deviceStatus:  Map<Bytes<32>, Status>;     // deviceId -> status
export ledger deviceEpoch:   Map<Bytes<32>, Uint<64>>;   // epoch the device last attested against
export ledger operatorPk:    Bytes<32>;                  // registry operator identity
```

## Circuits
- `approveFirmware(commitment, index)` — operator-only. `approvedSet.insertIndex(...)`, bump epoch.
- `revokeFirmware(index)` — operator-only. `approvedSet.insertIndexDefault(index)` (**documented as "emulates removal"**), bump epoch. *This is the CVE moment.*
- `attest(deviceId)` — device. Private witnesses: firmware hash + randomness + Merkle path. Recomputes the commitment, computes `merkleTreePathRoot(path)`, asserts `approvedSet.checkRoot(...)`, writes status COMPLIANT at the current epoch.

## Locked decisions
1. **Membership via Compact stdlib Merkle primitives.** There is no `.member()` method — membership is proven *only* by `merkleTreePathRoot<10, Bytes<32>>(path)` + `checkRoot`, with the path arriving through a **witness** (`findPathForLeaf` is TypeScript-only and will not compile inside a circuit).
2. **Plain `MerkleTree`, NOT `HistoricMerkleTree`.** General guidance prefers `HistoricMerkleTree` because `MerkleTree.checkRoot` accepts only the *current* root, invalidating in-flight proofs. **For NightSeal that is precisely the desired security property:** `HistoricMerkleTree.checkRoot` accepts *any past root*, which would let a revoked device keep passing forever and destroy the entire product claim. We take the "downside" deliberately.
   - *Rejected:* HistoricMerkleTree (breaks revocation); ZK non-membership proofs (forbidden by brief, and unnecessary).
3. **Leaves are commitments, not raw firmware hashes.** Merkle leaves live in public ledger state, so inserting a raw hash would publish it. Leaf = `persistentCommit([pad(32,"nightseal:fw:"), firmwareHash], randomness)`, mirroring the official `ticket.compact` pattern. The chain therefore shows only opaque commitments.
   - Trust model: the registry operator knows the firmware hashes (it approves builds) and issues each vendor its randomness + path privately. Honest limitation — recorded in GAPS.md.
4. **Revocation = `insertIndexDefault` on the revoked leaf.** Root changes → every outstanding proof against the old root stops verifying. Replay of an old proof is rejected by the same mechanism.
5. **Three visible UI states, derived from public state only:**
   - `COMPLIANT` — status COMPLIANT **and** `deviceEpoch == baselineEpoch` (green)
   - `RE-ATTESTATION REQUIRED` — attested, but `deviceEpoch < baselineEpoch` (amber; every device enters this the instant the baseline changes)
   - `NON-COMPLIANT` — re-attestation attempted and the proof **rejected on-chain** (red)
   Stronger and more honest than a bare green→red flip: after the CVE the clean device goes amber→green while the revoked one goes amber→red, and the difference is produced by cryptography, not by UI state.
6. **A failed attestation is a rejected transaction**, not a ledger write — recording "this device failed" on-chain would require proving non-membership. The rejection is the evidence; the UI surfaces the verifier error. Recorded in GAPS.md.
7. Verify all Compact/tooling facts against live docs before writing code — see [docs/TOOLCHAIN_FACTS.md](docs/TOOLCHAIN_FACTS.md).
8. **The web app uses a headless operator service, not a browser wallet extension.**
   - The **auditor dashboard is read-only and needs no wallet at all** — it renders public
     ledger state fetched from the indexer. That is the product claim made literal: anyone
     can audit compliance with nothing but a URL, and still sees no firmware data.
   - Privileged actions (approve / revoke / attest) POST to a small local Node service that
     signs with the headless wallet — the same code path the CLI uses. A registry operator
     realistically runs a service, not a browser extension.
   - *Rejected:* Lace + `dapp-connector-api` in the browser. It would add an install-and-fund
     step for every judge, and Lace reportedly does not implement `getProvingProvider()`, so a
     local proof server would be required anyway. The reliability cost is not worth it with a
     fixed deadline. Recorded as a limitation in GAPS.md.

## Decision log
- 2026-08-25: repo on GitHub `Harshyadav442277/Midnight-hackathon`.
- 2026-08-25: build env = WSL Ubuntu 26.04 (see above). compact CLI 0.5.2, compiler 0.31.1, language 0.23, Node 24.19, proof-server `midnightntwrk/proof-server:8.1.0`.
- 2026-08-25: target network **Preview** (`setNetworkId('preview')`), indexer `https://indexer.preview.midnight.network/api/v4/graphql`, explorer `https://preview.midnightexplorer.com/`.
- 2026-08-25: base the repo layout on **example-bboard** (active) rather than example-counter (archived).
