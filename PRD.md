# PRD — NightSeal (frozen for MVP)

## Problem
Regulators (CERT-In directions, NIST SP 800-193, IEC 62443, EN 303 645) increasingly demand proof of firmware provenance. But publishing firmware hashes, versions, or SBOMs hands attackers a target map and leaks competitive data. Vendors need to *prove* compliance without *disclosing* internals.

> "Your router's manufacturer must prove its firmware is clean — without publishing a map of its insides for attackers."

## Users
1. **Registry operator** — maintains the approved firmware baseline (Merkle set of approved firmware hashes); publishes updated roots when a CVE revokes a firmware build.
2. **Vendor / device** — holds its firmware hash privately; proves in ZK it is a member of the current approved set; its device ID's public status flips to compliant.
3. **Verifier / auditor** — anyone; reads public compliance status per device on the dashboard and verifies transactions on the public block explorer. Sees zero sensitive data.

## MVP features + acceptance criteria
| # | Feature | Done means |
|---|---------|------------|
| 1 | Membership circuit | Device with an approved firmware hash produces a valid proof against the current root; a non-member hash cannot. Private witness never on-chain. |
| 2 | Attestation entrypoint | Valid proof flips the device ID's public status to COMPLIANT with the root epoch it attested against; visible via indexer/explorer. |
| 3 | Root update (revocation) | Operator publishes a new approved root in one transaction; explorer shows the root-update tx. |
| 4 | Re-attestation failure | Device on revoked firmware fails re-attestation after root update; status visibly NOT compliant against current epoch. Old proof replayed against new root is rejected. |
| 5 | Auditor dashboard | Device list, big green PASS / red FAIL per device, flips with color+timestamp on revocation. |
| 6 | Attest panel | Second screen/tab: pick device, run attestation (calls proof server, submits tx). |
| 7 | Deployed | Contract live on Preview or PreProd; address + explorer link at top of README. |

## Stretch (only if all MVP done + video recorded)
- Root-update history list in UI (from chain data).
- Nicer device metadata labels (client-side only).

## Non-goals (guardrail — do not build)
SBOM parsing, multiple component types, supplier hierarchies, historic-root queries, multi-tenant anything, auth/login, settings pages, mobile, token economics, real TPM/measured-boot integration (mocked, disclosed).
