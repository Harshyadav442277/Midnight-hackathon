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

## Commands (verified working — run from the repo root in WSL)
The working tree is **`/root/nightseal` inside WSL Ubuntu** (`\\wsl.localhost\Ubuntu\root\nightseal` from Windows).
The Compact compiler has no Windows build, so everything below runs in WSL.

- Compile contract: `npm run compact` — fast iteration: `npm run compact:fast --workspace contract` (`--skip-zk`, ~0.3s)
- Typecheck everything: `npm run typecheck`
- Test: `npm test` (9 lifecycle tests)
- Build all: `npm run build`
- Proof server: `docker run -d --name nightseal-proof-server -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v`
  (health check is `GET /`, not `/health`)
- CLI: `npm run cli -- <address|balance|dust|deploy|approve|revoke <build>|attest <device>|status>`
- Operator service + dashboard: `npm run serve` → http://localhost:8787
- UI dev server: `npm run dev --workspace ui`

**Long-running processes must be held open by a background task** — a `nohup`'d process dies when the
`wsl.exe` invocation exits.

## Conventions
- TypeScript strict everywhere. Boring, explicit code. Files under ~300 lines.
- No secrets in repo: `.env` (gitignored) from first commit. Test-wallet seed lives in `.env` only.
- Commit after every working increment; message describes the change, nothing else (no attribution lines of any kind).

## Standing orders
1. Session start: read MEMORY.md → ARCHITECTURE.md → top unchecked TASKS.md item.
2. After every change: compile → typecheck → test; fix before reporting done.
3. Session end: update MEMORY.md, GAPS.md, TASKS.md; commit.
4. ~~Student eligibility~~ — **confirmed by the user 2026-08-25.**
5. Verify Midnight facts against live docs (https://docs.midnight.network/), not memory — see [docs/TOOLCHAIN_FACTS.md](docs/TOOLCHAIN_FACTS.md).
6. Never commit `.env`, and never put the wallet seed anywhere but `.env`. Anything deployed publicly (e.g. Vercel) gets **read-only** access — the operator seed stays local.
