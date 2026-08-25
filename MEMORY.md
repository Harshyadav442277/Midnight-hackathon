# MEMORY — session continuity

## Current status (2026-08-25, session 1, ~10:20 IST)
- ~T-45h to deadline (2026-08-27 07:00 IST). Student eligibility **confirmed by user**.
- **Working tree moved to WSL: `/root/nightseal`** (Windows path `\\wsl.localhost\Ubuntu\root\nightseal`).
  The OneDrive folder is only the original launch dir — do not edit code there.
- Environment GREEN: compact CLI 0.5.2 + compiler 0.31.1, Node 24.19 (WSL Ubuntu 26.04),
  proof server container `nightseal-proof-server` healthy on :6300 (reachable from Windows *and* WSL).
- **Contract compiles and all 9 lifecycle tests pass**; contract + CLI typecheck clean.
- CLI can build a wallet and print its funding address.

## Blocked on (human step)
- **Faucet funding.** The Preview faucet is CAPTCHA-gated, so the user must do it.
  Operator address: `mn_addr_preview14066huxp7t3rjx85pkptfgcntcny8ul0tjx8q0dl4d838gnwu2psw8jw44`
  Faucet: https://midnight-tmnight-preview.nethermind.dev/
  Then `npm start -- dust` (NIGHT alone cannot pay fees; it must be registered for DUST generation).

## Next 1–3 tasks
1. Once funded: `npm start -- deploy` → address saved to deployment.json, screenshot explorer. **Kills the disqualification gate.**
2. Run the full on-chain lifecycle (attest → revoke → re-attest fails); record tx hashes in docs/EVIDENCE.md.
3. Build the two-screen web UI (auditor dashboard + attest panel).

## Gotchas learned
- Compact compiler has **no Windows binary** — WSL is mandatory. `--skip-zk` compiles in 0.3s for fast iteration.
- Compact requires `disclose()` even on **public circuit parameters** that reach ledger ops.
- `MerkleTreeDigest.field` is a **bigint**, not bytes.
- Node `--experimental-strip-types` rejects **constructor parameter properties** (`constructor(readonly x: T)`).
- WSL git needs the Windows credential helper, or `git push` hangs forever:
  `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`
- The proof server's health endpoint is `/` (not `/health`); first boot downloads ZK params from srs.midnight.network.
- Git identity: Harshyadav442277 / hyadav42774@gmail.com. Plain commit messages, no attribution lines.
