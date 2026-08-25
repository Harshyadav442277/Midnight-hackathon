# CLAUDE.md — NightSeal operating rules

**Goal:** privacy-preserving firmware attestation registry on Midnight. Devices prove in ZK that their firmware hash is in the approved baseline (Merkle set); the chain shows only yes/no status. Revocation = publish new root; revoked devices visibly fail re-attestation.

**Deadline: 2026-08-27 07:00 IST** (Brainwave 2026 — Midnight Track, Devpost). Hard gate: contract deployed on Midnight Preview or PreProd + working demo + clear docs.

## Docs (read at session start, keep current)
- [BUILD_BRIEF.md](BUILD_BRIEF.md) — the locked idea/design/scope. Do not relitigate.
- [MEMORY.md](MEMORY.md) — session continuity. Read FIRST, update at session end.
- [ARCHITECTURE.md](ARCHITECTURE.md) — decisions + rationale. Code must conform; update it before deviating.
- [TASKS.md](TASKS.md) — execution board. One task = one change = one commit.
- [GAPS.md](GAPS.md) — honesty ledger; feeds README "Assumptions & Limitations".
- [PRD.md](PRD.md) — frozen MVP scope.
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) — the build aims at making this demoable.

## Commands
(fill in as toolchain lands — keep these exact and current)
- Compile contract: `npm run compact` (in `contract/`)
- Typecheck: `npm run typecheck`
- Test: `npm run test`
- Deploy: `npm run deploy` (in `cli/` or `contract/`)
- Proof server: `docker run -p 6300:6300 midnightnetwork/proof-server -- 'midnight-proof-server --network <net>'` (verify tag/net)
- App dev: `npm run dev` (in `ui/`)

## Conventions
- TypeScript strict everywhere. Boring, explicit code. Files under ~300 lines.
- No secrets in repo: `.env` (gitignored) from first commit. Test-wallet seed lives in `.env` only.
- Commit after every working increment; message describes the change, nothing else (no attribution lines of any kind).

## Standing orders
1. Session start: read MEMORY.md → ARCHITECTURE.md → top unchecked TASKS.md item.
2. After every change: compile → typecheck → test; fix before reporting done.
3. Session end: update MEMORY.md, GAPS.md, TASKS.md; commit.
4. **BLOCKER before Devpost submission: user must explicitly confirm student eligibility (event is students-only). Never submit without it.**
5. Verify Midnight facts against live docs (https://docs.midnight.network/), not memory.
