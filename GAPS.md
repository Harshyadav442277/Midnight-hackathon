# GAPS — the honesty ledger

Known mocks, shortcuts, caveats. Updated every session. Feeds README "Assumptions & Limitations".

## Standing (by design — disclosed)
- **Root of trust is mocked.** The "device" is a simulator script supplying its firmware hash directly. Real deployments: measured boot + TPM quote (NIST SP 800-193, TCG RA). Boundary labeled out-of-scope in the architecture diagram.
- **Single operator key** updates the root — no governance/multisig. Fine for MVP; noted as production gap.
- **Device IDs are self-chosen** in the demo (no device identity PKI). Registry-grade identity is out of scope.

## Current (update each session)
- 2026-08-25: nothing built yet; environment being set up. Docker Desktop had to be started manually — cold-start lag noted.
- Project dir is under OneDrive — potential npm/node_modules sync friction on Windows; if installs misbehave, move build to WSL filesystem (decision to be recorded here + ARCHITECTURE.md).
- **Student-eligibility confirmation from the user still outstanding — blocking for submission, not for build.**
