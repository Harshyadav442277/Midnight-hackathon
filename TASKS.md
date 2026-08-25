# TASKS — execution board

`[ ]` todo · `[~]` in progress · `[x]` done. One task = one change = one commit.
**Order is mandatory: nothing below Phase D starts until the deploy gate is dead.**

## Phase D — kill the deploy gate (NOW)
- [x] Faucet funding confirmed — 5,000 tNIGHT; faucet tx recorded in docs/EVIDENCE.md
- [x] DUST registration confirmed — balance accrued and fees paying successfully
- [x] Proof server healthy on :6300 (Windows docker engine; reachable from WSL too — verified)
- [x] Proving keys regenerated after tree alignment (~27 MB, all four circuits)
- [x] **Deployed to Preview** — `160c6bfcd360c8806bea5d45740f45d80930482038f57e55b72f6d002bb0ef6e` (2026-08-25 ~16:16 IST; deployment.json committed)
- [x] **Baseline bootstrap complete** — 9 transactions on-chain (3 registrations + 4 components + 2 builds), epoch 7; hashes in docs/EVIDENCE.md. Took 4 attempts: two real infra bugs found and fixed (duplicate WASM runtime; private-state address scoping)
- [x] Contract address + explorer link in the README deployment block and docs/SUBMISSION.md
- [x] Beat 1 PASS captured — both devices attested on-chain at epoch 7 (hashes in docs/EVIDENCE.md)
- [ ] Beats 2–4: revoke + clean recovery + selective fail + consensus replay; fill remaining docs/EVIDENCE.md rows
- [ ] Explorer screenshots (contract + root-update tx) saved to docs/
- [ ] Record raw footage of every beat **while** doing the above — never bet on one final take

## Phase B — consensus-evidence upgrade (deploy-safe)
- [x] Held-transaction stale replay implemented — capture at `balanceTx` (proven but unbalanced, so the revocation keeps its fee funds), then balance + submit after the roots move
- [x] `replay <device> <component>` CLI verb + `/api/replay/:device/:component` route + dashboard "Revoke + replay stale proof" control
- [ ] **Verify on Preview** (the one remaining unknown); then add the rejected replay to docs/EVIDENCE.md and upgrade GAPS + ARCHITECTURE decision 7 to the stronger claim
- [ ] Record Beat 3b footage (docs/DEMO_SCRIPT.md)

## Phase F — final submission
- [ ] ~3-min video per docs/DEMO_SCRIPT.md (include Beat 3b only if Phase B landed)
- [x] Read-only auditor dashboard **live at https://nightseal.vercel.app** (`NIGHTSEAL_CONTRACT_ADDRESS` set in Vercel; `/api/state` verified returning live indexer data; the operator seed never leaves the local machine)
- [ ] Final `npm run typecheck && npm test && npm run build`; commit; push
- [ ] Devpost form + video + public repo link — **well before Aug 27 07:00 IST** (docs/SUBMISSION.md is paste-ready)

## Optional (only with clear margin after the video exists)
- [ ] E: `reveal <build>` break-glass disclosure verb + README paragraph (~30 min)
- [ ] D: vendor-blind approval workflow (CLI-only restructure; contract already supports it)
- [ ] Cover-rotation CLI verb (`rotate`) to show update indistinguishability on the explorer

## Contingency triggers (unchanged)
- Aug 26 07:00 IST and no deployed contract → cut to thin-but-deployed and submit.

## Done (compressed)
- [x] Phases 0–3 build-out: toolchain (WSL, compact 0.31.1, proof server 8.1.0), contract with two
      current-only capability trees + device-bound attest + operation-hiding tombstone updates,
      11 adversarial tests, CLI + headless wallet + operator service, auditor dashboard,
      docs system, innovation audit, paste-ready submission copy, deployment runbook.
- [x] 2026-08-25 evening: git histories unified on GitHub `main`; WSL mirrors `origin/main`
      (snapshot on `backup/pre-align`); unused deps/dead code removed; baseline re-verified
      green (typecheck clean, 11/11 tests, UI production build).
