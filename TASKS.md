# TASKS — execution board

`[ ]` todo · `[~]` in progress · `[x]` done. One task = one commit. Order is mandatory (BUILD_BRIEF §5).

## Phase 0 — kill the disqualification gate (budget ~4h, by ~14:00 IST Aug 25)
- [x] Git repo init + remote (github.com/Harshyadav442277/Midnight-hackathon)
- [x] Doc system created (PRD, ARCHITECTURE, GAPS, MEMORY, TASKS, CLAUDE, DEMO_SCRIPT)
- [~] Verify current toolchain/network facts against live docs (research workflow)
- [ ] Install Compact compiler + dev tools; `compact compile` works on a hello contract
- [ ] Proof server running in Docker (version-matched to compiler)
- [ ] Test wallet created (headless, seed in .env); tDUST requested from faucet **EARLY**
- [ ] Stub contract deployed to Preview or PreProd; explorer entry screenshot saved to docs/
- [ ] Update CLAUDE.md "Commands" with real, verified commands

## Phase 1 — the real contract (budget ~8–10h)
- [ ] NightSeal Compact contract: approved-set MerkleTree + attest circuit + updateRoot + deviceStatus map
- [ ] Compiles clean; TS types generated
- [ ] Contract tests (simulator): attest passes for member; non-member fails; root update; re-attest fails; replay rejected
- [ ] Deploy to Preview/PreProd; run full lifecycle on-chain; save tx hashes (attest / root-update / failed re-attest) to docs/EVIDENCE.md
- [ ] Record raw footage of lifecycle (screen capture) — incremental demo material

## Phase 2 — the app (budget ~8–10h)
- [ ] Scaffold web app (two screens max: auditor dashboard + attest panel)
- [ ] Wire Midnight.js providers + proof server + wallet
- [ ] Auditor dashboard: device list, big PASS/FAIL, green→red flip with motion+timestamp (ALL polish hours here)
- [ ] Attest panel: pick device → prove → submit
- [ ] Operator action: publish new root (button or CLI — whichever is cheaper)
- [ ] Record raw footage of the flip

## Phase 3 — video + README (budget ~6–8h; record incrementally throughout)
- [ ] README per BUILD_BRIEF §7 (address+explorer link at top, tables, diagram, Beyond-the-tutorials, ≤5-command setup, assumptions)
- [ ] Architecture diagram (root-of-trust boundary labeled)
- [ ] ~3-min video per docs/DEMO_SCRIPT.md
- [ ] **USER CONFIRMS STUDENT ELIGIBILITY** (hard blocker for submission)
- [ ] Devpost submission (form + video link + public repo) — well before Aug 27 07:00 IST

## Contingency triggers
- Aug 26 07:00 IST and no deployed contract → cut frontend to one screen, submit thin-but-deployed.
