# MEMORY — session continuity

## Current status (2026-08-25, session 1, ~09:45 IST)
- T-45h to deadline (2026-08-27 07:00 IST).
- Repo initialized on `main`; remote `origin` = https://github.com/Harshyadav442277/Midnight-hackathon.git (was empty).
- Doc system written. No feature code yet.
- Research workflow (`midnight-docs-research`) launched against live Midnight docs: toolchain install, proof server, networks/faucet, example-counter structure, Compact Merkle syntax, Midnight.js API.
- Docker Desktop was not running; started it — verify daemon is up before proof-server work.

## In progress
- Phase 0: environment setup. Waiting on research results to pick exact install commands.

## Next 1–3 tasks
1. Install Compact toolchain per verified docs; compile a hello contract.
2. Proof server container up (version-matched).
3. Wallet + faucet request (EARLY — faucet can stall), then stub deploy to Preview/PreProd.

## Gotchas learned
- Host: Windows 11, Node v24.19.0, npm 11.13.0, Docker 29.7.2 (Desktop, WSL2 backend), git 2.51 — PowerShell 7.
- `gitStatus` snapshot at session start can be stale — trust `git status` output.
- Project dir under OneDrive — watch for node_modules sync pain; fallback: build in WSL fs.
- Git identity: Harshyadav442277 / hyadav42774@gmail.com. Commits: plain messages, no attribution lines (user's global rule).
- Student-eligibility confirmation outstanding (blocks submission only).
