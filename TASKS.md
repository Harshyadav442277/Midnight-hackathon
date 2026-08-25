# TASKS — execution board

`[ ]` todo · `[~]` in progress · `[x]` done. One task = one commit. Order is mandatory (BUILD_BRIEF §5).

## Phase 0 — kill the disqualification gate (budget ~4h, by ~14:00 IST Aug 25)
- [x] Git repo init + remote (github.com/Harshyadav442277/Midnight-hackathon)
- [x] Doc system created (PRD, ARCHITECTURE, GAPS, MEMORY, TASKS, CLAUDE, DEMO_SCRIPT)
- [x] Verify current toolchain/network facts against live docs → docs/TOOLCHAIN_FACTS.md
- [x] Install Compact compiler + dev tools (WSL Ubuntu; no Windows binary exists)
- [x] Proof server running in Docker (`midnightntwrk/proof-server:8.1.0`, healthy on :6300)
- [x] Test wallet created (headless, seed in .env)
- [~] tDUST from faucet — **CAPTCHA-gated, needs the user**; then `npm start -- dust`
- [ ] Contract deployed to Preview; explorer entry screenshot saved to docs/
- [x] Update CLAUDE.md "Commands" with real, verified commands

## Phase 1 — the real contract (budget ~8–10h)
- [x] NightSeal Compact contract: two current-only capability trees + device-bound attest + status map
- [x] Flagship: private three-component manifests with cascading component revocation
- [x] Secondary: registered device-secret proof-of-possession blocks cross-device authorization
- [x] Stretch: operation-hiding leaf updates (approval / tombstone revocation / cover rotation share one circuit shape)
- [x] Full Compact compile clean; TS types and proving assets generated
- [x] Contract tests (11): lifecycle, impersonation, component substitution, two-root replay, rogue operator, secrecy serialization
- [ ] Deploy to Preview/PreProd; run full lifecycle on-chain; save successful tx hashes and the failed-proof error to docs/EVIDENCE.md
- [ ] Record raw footage of lifecycle (screen capture) — incremental demo material

## Phase 2 — the app (budget ~8–10h)
- [x] Scaffold web app (auditor dashboard + inline attest/operator controls)
- [x] Wire Midnight.js providers + proof server + headless wallet/operator service
- [x] Auditor dashboard: two roots, device binding, green/amber/red compliance states
- [x] Attest controls: device-bound firmware + component proof
- [x] Operator action: private dependency panel + cascading component revocation
- [x] Production build and in-app browser flow verified; Vite 7/8 dev mismatch fixed
- [ ] Record raw footage of the flip

## Phase 3 — video + README (budget ~6–8h; record incrementally throughout)
- [x] README pitch, privacy table, mechanism, Beyond-the-tutorials, setup, limitations
- [x] Architecture diagram (root-of-trust boundary + two cryptographic gates)
- [x] Innovation ranking and selection audit
- [x] Paste-ready Devpost submission copy and deployment/evidence runbook
- [ ] ~3-min video per docs/DEMO_SCRIPT.md
- [x] **USER CONFIRMS STUDENT ELIGIBILITY** — confirmed by user 2026-08-25
- [ ] Devpost submission (form + video link + public repo) — well before Aug 27 07:00 IST

## Contingency triggers
- Aug 26 07:00 IST and no deployed contract → cut frontend to one screen, submit thin-but-deployed.
