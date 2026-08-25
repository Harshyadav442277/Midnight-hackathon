# TASKS — execution board

`[ ]` todo · `[~]` in progress · `[x]` done. One task = one change = one commit.
**Order is mandatory: nothing below Phase D starts until the deploy gate is dead.**

## Phase D — kill the deploy gate (NOW)
- [x] Faucet funding confirmed — 5,000 tNIGHT; faucet tx recorded in docs/EVIDENCE.md
- [~] DUST registration — submitted via `npm run cli -- dust`; confirm `npm run cli -- balance` shows `DUST > 0` before deploying
- [x] Proof server healthy on :6300 (Windows docker engine; reachable from WSL too — verified)
- [x] Proving keys regenerated after tree alignment (~27 MB, all four circuits)
- [ ] Deploy: `npm run cli -- deploy 2>&1 | tee docs/deploy-preview.log` (follow docs/DEPLOYMENT_RUNBOOK.md §2)
- [ ] Paste contract address + explorer link into the README deployment block and docs/SUBMISSION.md
- [ ] Live lifecycle per runbook §3; replace every `pending` row in docs/EVIDENCE.md, including the failed-attempt error text
- [ ] Explorer screenshots (contract + root-update tx) saved to docs/
- [ ] Record raw footage of every beat **while** doing the above — never bet on one final take

## Phase B — consensus-evidence upgrade (deploy-safe; start only after footage is secured)
- [ ] Held-transaction stale replay, per the sketch in docs/improvementsByClaude.md §STATUS (timebox ~90 min; the fallback there is acceptable)
- [ ] `replay <device>` CLI verb + dashboard "Replay stale proof" control; surface the node's rejection verbatim
- [ ] Verify on Preview; add the rejected replay to docs/EVIDENCE.md; upgrade GAPS + ARCHITECTURE decision 7 wording to the stronger claim
- [ ] Record optional Beat 3b footage (docs/DEMO_SCRIPT.md)

## Phase F — final submission
- [ ] ~3-min video per docs/DEMO_SCRIPT.md (include Beat 3b only if Phase B landed)
- [ ] Read-only auditor dashboard deployed to Vercel (`NIGHTSEAL_CONTRACT_ADDRESS` env; read-only — the operator seed never leaves the local machine)
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
