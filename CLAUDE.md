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

## Where things run (verified 2026-08-25 evening)
- **GitHub `main` is the canonical history.** Edit and commit on the **Windows checkout** (this folder);
  **WSL Ubuntu `/root/nightseal` mirrors `origin/main`** and runs every build/test — the Compact
  compiler has no Windows build. Sync via git (push from Windows → `git reset --hard origin/main` in WSL),
  never by copying files.
- Invoke WSL from Windows as `wsl.exe -d Ubuntu bash -lc '<command>'` — the direct-command form
  (`wsl.exe -d Ubuntu <command>`) can fail silently and return empty output.
- **Docker runs on the Windows engine only** (`docker` is unavailable inside WSL — Desktop's WSL
  integration is off). Mirrored networking makes `localhost:6300` reachable from both sides.

## Commands (run in WSL from `/root/nightseal`, unless marked Windows)
- Compile contract: `npm run compact` — fast iteration: `npm run compact:fast --workspace contract` (`--skip-zk`, ~0.3s)
  Full compile regenerates `contract/src/managed/nightseal/keys/` (~27 MB, gitignored) — required before deploy/attest.
- Typecheck everything: `npm run typecheck`
- Test: `npm test` (13 lifecycle/adversarial tests)
- Build all: `npm run build`
- Proof server (**Windows**): `docker start nightseal-proof-server` — container exists; health check is `GET /` on :6300, not `/health`
- CLI: `npm run cli -- <address|balance|dust|deploy|approve|revoke-component <component>|revoke <build>|attest <device>|replay <device> <component>|status>`
  Every CLI command re-syncs the wallet from genesis (~10 min). For multi-step work, start
  `npm run serve` once and drive it over HTTP (`/api/attest/:id`, `/api/revoke-component/:id`,
  `/api/replay/:device/:component`, `/api/approve`) — each action then takes seconds.
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
