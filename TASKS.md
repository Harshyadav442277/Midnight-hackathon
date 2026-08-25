# TASKS — execution board

`[ ]` todo · `[~]` in progress · `[x]` done. One task = one change = one commit.

## What is left (both are human tasks)
- [ ] **Record the ~3-minute demo video** per [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).
      The chain is already in a clean demo state (epoch 14, all components approved, both
      devices COMPLIANT) — see MEMORY.md for the exact start/reset commands.
- [ ] **Submit on Devpost** — form + video link + public repo, well before Aug 27 07:00 IST.
      [docs/SUBMISSION.md](docs/SUBMISSION.md) is paste-ready with contract, dashboard, and
      transaction links already filled in.
- [ ] Optional: explorer screenshots into `docs/` (the links already resolve publicly).

## Done — deployment and evidence
- [x] Faucet funding, DUST registration, proof server, proving keys
- [x] **Contract deployed to Preview** — `160c6bfcd360c8806bea5d45740f45d80930482038f57e55b72f6d002bb0ef6e`
- [x] Baseline bootstrapped on-chain — 3 device registrations + 4 component + 2 firmware capabilities
- [x] **Full lifecycle executed and recorded** in docs/EVIDENCE.md: PASS → opaque component
      revocation (firmware root byte-identical) → clean recovery → selective failure →
      **consensus-rejected stale replay**
- [x] **Public read-only auditor dashboard live** at https://nightseal.vercel.app
- [x] README, SUBMISSION, EVIDENCE, ARCHITECTURE, GAPS all point at the executed lifecycle

## Done — engineering
- [x] Contract: two current-only capability trees, device-bound attestation, private three-slot
      component manifests, operation-hiding tombstone updates
- [x] Phase B upgrade: held-transaction stale replay (`replay` CLI verb, `/api/replay` route,
      dashboard control) — capture at `balanceTx` so the revocation keeps its fee funds
- [x] Device card distinguishes a consensus rejection from a local proof-construction failure
- [x] Two blocking infra bugs found and fixed: duplicate WASM runtime; private-state scoping
- [x] Debloat: unused deps and dead code removed; error causes surfaced via `cli/src/errors.ts`
- [x] 11/11 tests, typecheck clean, production build green

## Deferred (post-hackathon — rationale in docs/improvementsByClaude.md)
- Split-authority cascade (separate regulator key for the component tree)
- Vendor-blind approvals; break-glass selective disclosure
- Fleet-level threshold proofs (needs a confidential status model first)
