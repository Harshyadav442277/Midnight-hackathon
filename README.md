# NightSeal

**Your router's manufacturer must prove its firmware is clean — without publishing a map of its insides for attackers.**

NightSeal is a firmware attestation registry on [Midnight](https://midnight.network). A device proves in zero knowledge that its firmware is part of the manufacturer's *current approved baseline*. The public chain records only a yes/no compliance status — never the firmware hash, version, SBOM, or supplier list. When a CVE lands, the registry operator revokes the affected build, and every device running it immediately stops being able to prove compliance.

---

## Deployed contract

<!-- DEPLOYMENT:START -->
| | |
|---|---|
| **Network** | Midnight **Preview** |
| **Contract address** | `pending deployment` |
| **Explorer** | pending deployment |
<!-- DEPLOYMENT:END -->

---

## What is public, what is private, what is proven

| | |
|---|---|
| **Public, on-chain** | device id → compliance status, the baseline epoch each device attested against, the approved-set Merkle root, and opaque firmware *commitments* |
| **Private, never on-chain** | firmware measurements, blinding randomness, Merkle paths, versions, SBOM/HBOM, supplier lists |
| **Proven in zero knowledge** | *"I know a firmware measurement whose commitment is a leaf of the current approved-set root"* |

The point is the middle row. A regulator can demand proof of firmware provenance and get a verifiable answer; an attacker reading the same chain learns nothing about what is running on the device.

---

## The three-beat demo

1. **Pass.** A device attests. The dashboard turns green. The explorer shows the transaction — and nothing sensitive. *The chain shows a yes, never the firmware.*
2. **Revoke.** A CVE drops. The operator revokes the affected build in one transaction. The Merkle root moves, the baseline epoch increments, and every device drops to *re-attestation required*.
3. **Fail.** Both devices re-attest. The unaffected one goes green again. The device on the revoked build **cannot produce a valid proof at all** — its commitment is no longer in the tree, so there is no Merkle path to prove membership with. It goes red.

The difference between beats 2 and 3 is produced by cryptography, not by application logic.

---

## Architecture

![NightSeal architecture](docs/architecture.svg)

**The hardware root of trust is out of scope, by design.** A real deployment obtains the firmware measurement from measured boot and a TPM quote ([NIST SP 800-193](https://csrc.nist.gov/pubs/sp/800/193/final); TCG remote attestation). In this project a device simulator supplies that measurement directly. NightSeal's contribution is the privacy-preserving transparency layer *above* that boundary — the part that today either does not exist or requires publishing exactly the data you must not publish.

### How revocation actually works

The approved set is a Compact `MerkleTree<10, Bytes<32>>` whose leaves are commitments, not measurements — Merkle leaves are public ledger state, so storing a raw hash would publish it. Each leaf is `persistentCommit([pad(32,"nightseal:firmware:"), measurement], randomness)`.

Revoking a build calls `insertIndexDefault(index)`, the standard library's documented way to emulate removal. That changes the root.

> **One design decision carries the whole product.** The usual advice is to use `HistoricMerkleTree`, because a plain `MerkleTree.checkRoot` accepts only the *current* root and therefore invalidates in-flight proofs. NightSeal deliberately takes that "downside": `HistoricMerkleTree.checkRoot` accepts *any past root*, which would let a revoked device keep attesting successfully forever. The property that makes `MerkleTree` awkward for most applications is precisely the property that makes revocation real here.

---

## Beyond the tutorials

Midnight's official ZK Loan tutorial shares this skeleton — check something in zero knowledge, write a yes/no on-chain. NightSeal differs in the part that matters:

| | ZK Loan tutorial | NightSeal |
|---|---|---|
| Attestation | one-shot | **stateful, with an on-chain lifecycle** |
| Criteria | fixed at deployment | **revocable baseline the operator moves** |
| After the fact | a proof stays valid | **a published revocation invalidates outstanding proofs** |
| Failure mode | n/a | **a revoked device provably cannot construct a passing proof** |

The lifecycle — attest → CVE → root update → failed re-attestation — is implemented and exercised on-chain, not described. The revocation transaction is linked above.

## Why this needs Midnight specifically

Firmware attestation has two requirements that are normally in direct conflict. Regulators ([CERT-In directions](https://www.cert-in.org.in/), [IEC 62443](https://www.iec.ch/cyber-security), [EN 303 645](https://www.etsi.org/deliver/etsi_en/303600_303699/303645/)) increasingly demand demonstrable firmware provenance. Meanwhile publishing firmware hashes and SBOMs hands attackers a targeting map and leaks competitive information about suppliers and release cadence.

A transparent chain forces you to choose. Midnight's dual-ledger model does not: the shielded side holds the firmware measurement and the Merkle path, the public side holds a compliance status and a root, and the circuit binds them together. The verification is public and permissionless; the evidence stays private. That is the whole product, and it is not implementable on a chain with only public state.

---

## Run it

Prerequisites: Docker, Node 22+, and the [Compact toolchain](https://docs.midnight.network/getting-started/installation) (Linux or macOS — on Windows use WSL; there is no native Windows compiler build).

```bash
git clone https://github.com/Harshyadav442277/Midnight-hackathon.git nightseal && cd nightseal
npm install && npm run compact && npm run build
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
npm run cli -- address        # fund this address at the Preview faucet, then: npm run cli -- dust
npm run serve                 # dashboard + operator service on http://localhost:8787
```

Point the dashboard at the deployed registry above, or run `npm run cli -- deploy` to stand up your own.

**Verify the claims without deploying anything:**

```bash
npm test
```

Nine tests cover the lifecycle, including `never writes the firmware measurement to the ledger`, which serialises published state and asserts the secret does not appear in it.

### CLI

| Command | What it does |
|---|---|
| `npm run cli -- deploy` | deploy the registry and publish the approved baseline |
| `npm run cli -- attest <device>` | a device proves its firmware is in the baseline |
| `npm run cli -- revoke <build>` | revoke a build — the CVE moment |
| `npm run cli -- status` | print the public compliance state an auditor sees |

---

## Assumptions and limitations

Stated plainly, because a registry nobody can audit honestly is not worth building.

- **The hardware root of trust is mocked.** See the architecture note above. This is the single largest gap between this project and a deployable system.
- **The registry operator learns the firmware measurements.** It computes the commitments and issues the blinding factors, so NightSeal protects firmware data from the public chain and from attackers — not from the operator that approves builds. A production design would have vendors generate their own commitments.
- **A rejected attestation is not recorded on-chain.** Writing "device X failed" to the ledger would require proving *non*-membership, which this design deliberately refuses to do. A revoked device simply cannot build a valid proof. The dashboard's red state comes from the operator service's record of the last attempt, and the card says so. The on-chain evidence of revocation is the root change plus the device's now-stale epoch.
- **Compliance is epoch-relative.** Every device goes amber the moment the baseline moves, including unaffected ones — correct, since nobody has proved anything against the new root yet, but amber alone is not evidence of a vulnerability.
- **A single operator key** controls the baseline; there is no multisig or governance.
- **Device ids are self-asserted** — there is no device identity PKI binding an id to a platform key.
- **No browser wallet integration.** The auditor dashboard needs no wallet at all, which is the point; privileged actions go through a local operator service rather than Lace.

Full engineering ledger: [GAPS.md](GAPS.md) · design rationale and rejected alternatives: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Repository

| Path | |
|---|---|
| [`contract/src/nightseal.compact`](contract/src/nightseal.compact) | the contract — three circuits, ~100 lines |
| [`contract/src/test/`](contract/src/test/) | the lifecycle test suite |
| [`cli/src/`](cli/src/) | headless wallet, providers, registry operations, operator service |
| [`ui/src/`](ui/src/) | auditor dashboard |
| [`docs/TOOLCHAIN_FACTS.md`](docs/TOOLCHAIN_FACTS.md) | verified Midnight toolchain reference (August 2026) |

Licensed under Apache-2.0.
