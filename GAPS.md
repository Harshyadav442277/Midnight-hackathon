# GAPS — the honesty ledger

Known mocks, shortcuts, caveats. Updated every session. Feeds the README's "Assumptions & Limitations".

## Standing (by design — disclosed)
- **The hardware root of trust is mocked.** The "device" is a simulator that supplies its own firmware measurement. Real deployments obtain it from measured boot + a TPM quote (NIST SP 800-193, TCG remote attestation). That layer is deliberately out of scope; NightSeal is the privacy-preserving transparency layer above it.
- **The registry operator learns the firmware measurements.** Merkle leaves are commitments, so nothing sensitive is published on-chain — but the operator computes those commitments and therefore knows the measurements and issues the blinding factors. NightSeal protects firmware data from *the public chain and from attackers*, not from the operator that approves builds. A production system would have vendors submit commitments they generate themselves.
- **A single operator key** controls the baseline — no multisig or governance.
- **Device IDs are self-asserted.** There is no device identity PKI, so nothing stops a device from attesting under another device's id. Real deployments would bind the device id to the platform key.
- **A rejected attestation is not on-chain.** Recording "device X failed" on the ledger would require proving *non*-membership, which this design deliberately refuses to do. A revoked device simply cannot produce a valid proof. The dashboard's red NON-COMPLIANT state therefore comes from the operator service's record of the last attempt — the card and the README both say so explicitly. The on-chain evidence of revocation is the root change plus the device's stale epoch.
- **Compliance is epoch-relative.** Every device goes amber ("re-attestation required") the instant the baseline moves, including unaffected ones. That is intentional and correct — after a baseline change nobody has proved anything against the new root yet — but it means amber is not by itself evidence of a vulnerability.

## Resolved
- ~~Student-eligibility confirmation outstanding~~ — **confirmed by the user, 2026-08-25**.
- ~~OneDrive/node_modules friction~~ — working tree moved to WSL at `/root/nightseal`; the Compact compiler has no Windows binary, so WSL was required regardless.

## Current (update each session)
- 2026-08-25: **Not yet deployed to Preview.** The faucet is CAPTCHA-gated and needs a human; everything downstream of funding is built and tested but unverified against the live network.
- The UI is exercised end-to-end against a local mock of the operator service; the on-chain path is covered by the contract test suite but has not yet run against Preview.
- No browser wallet (Lace) integration — privileged actions go through a local operator service. See ARCHITECTURE.md decision 8.
- `insertIndexDefault` is used for revocation on the strength of the documented "emulates removal" semantics; verified in the local simulator, not yet on-chain.
