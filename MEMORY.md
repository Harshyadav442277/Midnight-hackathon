# MEMORY — session continuity

## Current status (2026-08-25, ~16:15 IST — end of orchestration/debloat session)
- Deadline 2026-08-27 07:00 IST (~T-39h). Student eligibility confirmed.
- **Git is unified: GitHub `main` is the canonical history.** Edit/commit on the Windows
  checkout; WSL `/root/nightseal` mirrors `origin/main` for all builds (pre-upgrade WSL
  history preserved on WSL branch `backup/pre-align`). Sync = push from Windows, then
  `git fetch && git reset --hard origin/main` in WSL. Never sync by copying files.
- **Baseline green on the unified tree:** full `npm run compact` regenerated the proving
  keys (~27 MB, all four circuits), typecheck clean, **11/11 tests**, UI production build.
- **Debloat done:** removed unused deps (`dapp-connector-api`, `fetch-zk-config-provider`,
  `ts-node`, direct `axios`/`ws` — both still installed transitively by the SDK), the inert
  `resolutions` block, dead `lastPath` witness state, unused `getPrivateState`, and
  hand-rolled explorer URLs. Commit `be7f571`.
- **Upgrade state:** flagship (cascading component revocation), secondary (device-bound
  proofs), and stretch (operation-hiding tombstone updates) are all implemented and tested.
  Next build item is the **consensus-evidence stale-proof replay** — full plan and sketch in
  [docs/improvementsByClaude.md](docs/improvementsByClaude.md) §STATUS; execution order in
  [TASKS.md](TASKS.md) (Phase D → B → F). Split-authority is post-hackathon.

## Deploy gate — where it stands right now
- Faucet funding confirmed: 5,000 tNIGHT
  (tx `00388f16d712bd60fa0984f95afd76a803f938d59c61000a66194591fa52dbfc35`).
- **DUST registration SUBMITTED this session**:
  tx `00f6f659fcb0560232f644416e0e48ad8ab328b570340fb642dbef04126d32ed3d` (16:04 IST).
  DUST accrues over time — check `npm run cli -- balance` until `DUST > 0`, then deploy
  per [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md). Re-running `dust` is safe
  (it skips UTXOs already registered).
- **Proof server RUNNING and healthy** (:6300 answers from Windows and WSL). It runs on the
  **Windows** docker engine — the `docker` CLI does not exist inside WSL (Desktop WSL
  integration off; not needed). If it dies: from Windows, `docker start nightseal-proof-server`.
  Docker Desktop itself must be running (it was started this session).
- **DEPLOYED to Preview at ~16:16 IST**:
  contract `160c6bfcd360c8806bea5d45740f45d80930482038f57e55b72f6d002bb0ef6e`
  (`deployment.json` committed; README/SUBMISSION/EVIDENCE carry the explorer link).
  DUST accrued fine (~0.12 DUST at first synced check).
- **The same-process bootstrap FAILED ~2s after deploy** with `Unexpected error executing scoped
  transaction: expected instance of StateValue` — the indexer had not yet indexed the fresh
  contract when `findDeployedContract` re-queried it (see the runbook §2 wrinkle note). Deploy log
  preserved at `/root/nightseal/logs/serve-deploy-attempt1.log`.
- **Bootstrap attempt 2 also failed** — fresh-process private-state access needs
  `privateStateProvider.setContractAddress(...)` first (midnight-js 4.1.1 level provider).
  **Fixed in `joinRegistry`** (cli/src/registry.ts); runbook §2 documents both wrinkles.
  **Attempt 3 (`npm run cli -- approve`) is running in the background**, log:
  `/root/nightseal/logs/approve2.log`. On takeover: check it for nine `tx` hashes → copy into
  docs/EVIDENCE.md's bootstrap row → continue runbook §3 (lifecycle + footage). If it failed,
  read the error, fix, re-run — `approve` is idempotent. Dashboard afterwards: `npm run serve`
  (reuses deployment.json, skips deploying).
- **Public auditor dashboard LIVE: https://nightseal.vercel.app** (Vercel project `nightseal`,
  `NIGHTSEAL_CONTRACT_ADDRESS` env set for Production; `/api/state` verified returning live
  indexer JSON with `readOnly: true`). Deployment URLs are SSO-protected; the production domain
  is public — that split is Vercel's standard protection and is correct. Redeploy with
  `vercel deploy --prod --yes` from the Windows checkout.

## Immediate continuation (exact order — TASKS.md Phase D)
1. Confirm the background `approve` finished: nine tx hashes in `/root/nightseal/logs/approve.log`
   → copy into docs/EVIDENCE.md (bootstrap row). Re-run `npm run cli -- approve` if it failed.
2. `npm run serve` (reuses deployment.json) → dashboard on :8787 next to the explorer.
3. Lifecycle per runbook §3: attest sensor-gateway-02 → revoke-component tls-3.0-cve →
   attest sensor-gateway-02 (green) → attest router-fleet-07 (fails locally, no tx).
   Fill docs/EVIDENCE.md; screenshot explorer; record raw footage throughout.
4. Phase B (held-transaction consensus rejection) — only after footage is secured; timebox 90 min.
5. Video → Vercel read-only dashboard → final checks → Devpost. docs/SUBMISSION.md is paste-ready.

## Gotchas
- Invoke WSL as `wsl.exe -d Ubuntu bash -lc '<cmd>'` — the direct form (no `bash -lc`) can
  fail silently with empty output.
- WSL `/tmp` does not survive VM restarts — put logs that must persist under the repo
  (`logs/` is gitignored) or tee them to the Windows side.
- A failed post-revocation attest stops during local witness resolution — the service records
  the attempt for the red card. **Do not call it an on-chain failure unless Phase B lands.**
- Long-running processes must be held by a background task — a `nohup` dies when its
  `wsl.exe` invocation exits.
- Never commit `.env` (WSL-only; survives `git reset --hard` because it is ignored).
- Windows git may print CRLF warnings on commit — harmless; repo objects stay LF.
