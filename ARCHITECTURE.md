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
| **Public on-chain** | device ID → registered device-key commitment + compliance status + attested policy epoch; current firmware and component Merkle roots; opaque commitments; epoch history |
| **Private, never on-chain** | device secret, firmware measurement, component manifest and measurements, commitment randomness, Merkle paths, SBOM/versions/suppliers |
| **Provable** | "I control this registered device, its hidden firmware is currently approved, and every hidden component bound into that firmware is currently approved" |

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
export ledger componentSet:  MerkleTree<10, Bytes<32>>;  // leaves = component COMMITMENTS
export ledger baselineEpoch: Counter;                    // bumped on any firmware/component policy change
export ledger deviceIdentity: Map<Bytes<32>, Bytes<32>>; // deviceId -> H(device secret)
export ledger deviceStatus:  Map<Bytes<32>, Status>;     // deviceId -> status
export ledger deviceEpoch:   Map<Bytes<32>, Uint<64>>;   // epoch the device last attested against
export ledger operatorPk:    Bytes<32>;                  // registry operator identity
```

## Circuits
- `registerDevice(deviceId, identityCommitment)` — operator-only. Binds a public device id to a private device secret without changing firmware policy.
- `updateFirmwareLeaf(value, index)` — operator-only, operation-hiding firmware policy update. A real commitment approves; an opaque tombstone revokes; both move the policy epoch through the same public circuit.
- `updateComponentLeaf(value, index)` — identical operation-hiding shape for components. A tombstone removes proof power from every secretly dependent firmware image. *This is the flagship CVE moment.*
- `attest(deviceId)` — proves, in one circuit, knowledge of the registered device secret, current firmware membership, and current membership of all three hidden components bound into the firmware commitment. Only then writes COMPLIANT at the current epoch.

## Locked decisions
1. **Membership via Compact stdlib Merkle primitives.** There is no `.member()` method — membership is proven *only* by `merkleTreePathRoot<10, Bytes<32>>(path)` + `checkRoot`, with the path arriving through a **witness** (`findPathForLeaf` is TypeScript-only and will not compile inside a circuit).
2. **Plain `MerkleTree`, NOT `HistoricMerkleTree`.** General guidance prefers `HistoricMerkleTree` because `MerkleTree.checkRoot` accepts only the *current* root, invalidating in-flight proofs. **For NightSeal that is precisely the desired security property:** `HistoricMerkleTree.checkRoot` accepts *any past root*, which would let a revoked device keep passing forever and destroy the entire product claim. We take the "downside" deliberately.
   - *Rejected:* HistoricMerkleTree (breaks revocation); ZK non-membership proofs (forbidden by brief, and unnecessary).
3. **Leaves are commitments, not raw firmware/component hashes.** Merkle leaves live in public ledger state, so inserting raw measurements would publish them. Component leaves use domain-separated `persistentCommit`; a firmware leaf commits to both its measurement and a digest of its three private component commitments. The chain therefore shows opaque commitments while the circuit cryptographically binds the hidden composition to the approved firmware capability.
   - Trust model: the registry operator knows the firmware hashes (it approves builds) and issues each vendor its randomness + path privately. Honest limitation — recorded in GAPS.md.
4. **Revocation = replace the capability with an opaque tombstone.** Approval, revocation, and cover rotation all use the same `update*Leaf(value, index)` circuit. A fresh random tombstone has no known valid opening but is publicly indistinguishable from another opaque commitment. A component update changes `componentSet` without identifying dependent firmware; affected firmware then fails a current-root check even though its firmware leaf remains approved.
5. **Device identity is proof-of-knowledge, not a caller claim.** The operator registers `deviceId -> persistentHash(deviceSecret)`. Attestation compares that public commitment with a hash of the private `localSecretKey()` witness inside the ZK circuit. Device A's firmware opening cannot authorize Device B without B's secret. This does not replace the TPM/measured-boot boundary.
6. **Three visible UI states, derived from public state only:**
   - `COMPLIANT` — status COMPLIANT **and** `deviceEpoch == baselineEpoch` (green)
   - `RE-ATTESTATION REQUIRED` — attested, but `deviceEpoch < baselineEpoch` (amber; every device enters this the instant the baseline changes)
   - `NON-COMPLIANT` — local proof construction failed because a required current-tree path no longer exists; the operator service records that attempt (red)
   Stronger and more honest than a bare green→red flip: after the CVE the clean device goes amber→green while the revoked one goes amber→red, and the difference is produced by cryptography, not by UI state.
7. **A failed attestation is a rejected transaction**, not a ledger write — recording "this device failed" on-chain would require proving non-membership. The rejection is the evidence; the UI surfaces the verifier error. Recorded in GAPS.md.
8. **The component manifest has exactly three slots in the hackathon circuit.** Compact circuits are static; fixed arity keeps proving and deployment risk bounded. This is an explicit demo constraint, not a claim that production SBOMs contain only three components.
9. Verify all Compact/tooling facts against live docs before writing code — see [docs/TOOLCHAIN_FACTS.md](docs/TOOLCHAIN_FACTS.md).
10. **The web app uses a headless operator service, not a browser wallet extension.**
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
- 2026-08-25: flagship upgrade = firmware capabilities bound to private three-slot component manifests, with a second current-only Merkle root for cascading component revocation. Secondary = registered device-secret proof-of-possession. Implemented stretch = operation-hiding leaf updates with opaque tombstones. Full ranking: [docs/INNOVATION_AUDIT.md](docs/INNOVATION_AUDIT.md).
