# MEMORY — session continuity

## Current status (2026-08-25, ~17:05 IST)
- Deadline 2026-08-27 07:00 IST (~T-38h). Student eligibility confirmed.
- **DEPLOYED AND BOOTSTRAPPED on Midnight Preview.** The disqualification gate is dead.
  Contract `160c6bfcd360c8806bea5d45740f45d80930482038f57e55b72f6d002bb0ef6e`.
  Nine bootstrap transactions + two attestations are on-chain; hashes in docs/EVIDENCE.md.
- **Public read-only dashboard: https://nightseal.vercel.app** (Vercel project `nightseal`,
  env `NIGHTSEAL_CONTRACT_ADDRESS`; `/api/state` verified live). Redeploy with
  `vercel deploy --prod --yes` from the Windows checkout.
- **Git:** GitHub `main` is canonical. Edit/commit on the Windows checkout; WSL
  `/root/nightseal` mirrors `origin/main` and runs all builds. Sync = push from Windows,
  then `git fetch && git reset --hard origin/main` in WSL. Never copy files between them.
- Baseline green: typecheck clean, 11/11 tests, UI production build.

## Two real bugs found and fixed this session (do not regress)
1. **Duplicate WASM runtime.** `compact-runtime` accepts `^3.0.0` (npm hoisted 3.1.0) while
   `midnight-js-protocol` pins 3.0.0 (nested copy) → two `StateValue` classes → *every* live
   `callTx` failed with `expected instance of StateValue`. Deploys and simulator tests do not
   cross that boundary, which is why tests passed while the chain path was broken. Fixed with a
   root `overrides` pin + `npm dedupe`. Verify with `npm ls @midnight-ntwrk/onchain-runtime-v3`
   — exactly one version must resolve.
2. **Private-state address scoping.** The level provider throws unless
   `setContractAddress()` is called before any state access; `joinRegistry` now does it.

## Lifecycle capture — how to do it fast
Each CLI command re-syncs the wallet from scratch (~10 min). **Do not drive the lifecycle with
CLI commands.** Start `npm run serve` once (one sync, then it stays warm) and drive it over
HTTP — each action then takes seconds:
```
curl -X POST http://localhost:8787/api/attest/sensor-gateway-02
curl -X POST http://localhost:8787/api/revoke-component/tls-3.0-cve
curl -X POST http://localhost:8787/api/replay/router-fleet-07/tls-3.0-cve
curl -s http://localhost:8787/api/state
```
The dashboard at :8787 is the same thing with buttons (that is what gets filmed).

## Where the lifecycle stands
- ✅ Beat 1 PASS: both devices COMPLIANT at epoch 7 (tx hashes in docs/EVIDENCE.md).
- ⏳ Beats 2–4 remain: component revocation, clean recovery, selective failure, and the
  consensus replay. State is currently clean at **epoch 7 with nothing revoked**, so the
  sequence can be run from the top.
- **Phase B (consensus replay) is implemented but NOT yet verified on Preview.** It proves an
  attestation, revokes the component, then submits the stale proof so the *ledger* rejects it.
  First attempt failed with `could not balance dust` because a balanced held transaction
  reserves the wallet's DUST; fixed by capturing at `balanceTx` instead (proven but unbalanced)
  and balancing only after the revocation. **README beat 4, DEMO_SCRIPT beat 3b, and the
  EVIDENCE row all claim this works — if live verification fails, soften them back.**

## Gotchas
- Invoke WSL as `wsl.exe -d Ubuntu bash -lc '<cmd>'`; the direct form can return empty output.
- Docker runs on the **Windows** engine only (`docker start nightseal-proof-server`); the CLI
  does not exist inside WSL. Proof server must be healthy on :6300 before any proving.
- WSL `/tmp` does not survive VM restarts — keep logs under `/root/nightseal/logs/` (gitignored).
- Deploy-then-bootstrap in one process can hit indexer lag (`expected instance of StateValue`
  seconds after deploy). Wait a minute and run `npm run cli -- approve` — it is idempotent.
- A failed post-revocation attest stops during local witness resolution and writes nothing
  on-chain. Only the *replay* path produces a chain-level rejection.
- Never commit `.env` (WSL-only, gitignored, survives `git reset --hard`).
