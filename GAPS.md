# GAPS — the honesty ledger

Known mocks, shortcuts, caveats. Updated every session. Feeds the README's "Assumptions & Limitations".

## Standing (by design — disclosed)
- **The hardware root of trust is mocked.** The "device" is a simulator that supplies its own firmware measurement. Real deployments obtain it from measured boot + a TPM quote (NIST SP 800-193, TCG remote attestation). That layer is deliberately out of scope; NightSeal is the privacy-preserving transparency layer above it.
- **The registry operator learns the firmware measurements.** Merkle leaves are commitments, so nothing sensitive is published on-chain — but the operator computes those commitments and therefore knows the measurements and issues the blinding factors. NightSeal protects firmware data from *the public chain and from attackers*, not from the operator that approves builds. A production system would have vendors submit commitments they generate themselves.
- **A single operator key** controls the baseline — no multisig or governance.
- **Device identity is cryptographically bound, but the hardware protection is mocked.** The operator registers a commitment to each device secret and attestation proves knowledge of it, so one registered device cannot authorize another. The simulator stores that secret in local private state; production would protect it with a TPM/secure element and enroll it through a device PKI.
- **A rejected attestation is not on-chain.** Recording "device X failed" on the ledger would require proving *non*-membership, which this design deliberately refuses to do. A revoked device simply cannot produce a valid proof. The dashboard's red NON-COMPLIANT state therefore comes from the operator service's record of the last attempt — the card and the README both say so explicitly. The on-chain evidence of revocation is the root change plus the device's stale epoch.
- **Compliance is epoch-relative.** Every device goes amber ("re-attestation required") the instant the baseline moves, including unaffected ones. That is intentional and correct — after a baseline change nobody has proved anything against the new root yet — but it means amber is not by itself evidence of a vulnerability.
- **Component manifests are fixed to three slots in the hackathon circuit.** This makes the cascading proof static and predictable. A production profile would choose a larger bounded manifest or bind a private component-tree root and prove bounded paths.
- **Demo secrets are reproducible fixtures.** Firmware/component labels and relationships exist in the public source so judges can reproduce the demo. The privacy claim concerns ledger and public-auditor disclosure, not secrecy of deliberately published test fixtures.
- **Operation type is hidden, not all timing correlation.** Approval, tombstone revocation, and cover rotation share one opaque leaf-update circuit, but observers still see that a root/epoch moved and may correlate devices that do not re-attest afterward.
- **The local operator service has no application login.** It binds to `127.0.0.1` by default so privileged routes are not exposed to the LAN. A production deployment needs authenticated operator APIs and an HSM/vault-backed signing service.

## Resolved
- ~~Student-eligibility confirmation outstanding~~ — **confirmed by the user, 2026-08-25**.
- ~~OneDrive/node_modules friction~~ — working tree moved to WSL at `/root/nightseal`; the Compact compiler has no Windows binary, so WSL was required regardless.

## Current (update each session)
- 2026-08-25: **Not yet deployed to Preview.** The faucet is CAPTCHA-gated and needs a human; everything downstream of funding is built and tested but unverified against the live network.
- The UI is exercised end-to-end against a local mock of the operator service; the on-chain path is covered by the contract test suite but has not yet run against Preview.
- No browser wallet (Lace) integration — privileged actions go through a local operator service. See ARCHITECTURE.md decision 8.
- Opaque tombstone replacement is verified in the local simulator, not yet on-chain.
