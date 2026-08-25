# MEMORY — session continuity

## Current status (2026-08-25, ~17:35 IST)
- Deadline 2026-08-27 07:00 IST (~T-37h). Student eligibility confirmed.
- **Everything technical is DONE and verified on-chain.** What remains is the demo video and
  the Devpost form — both human tasks.
- Contract on Preview: `160c6bfcd360c8806bea5d45740f45d80930482038f57e55b72f6d002bb0ef6e`
- Public read-only dashboard: **https://nightseal.vercel.app** (live, serving indexer state)
- Repo: GitHub `main` is canonical, everything pushed and clean.

## What was proven on-chain (docs/EVIDENCE.md has every hash)
The complete lifecycle ran against the live Preview registry:
1. Both devices attested COMPLIANT.
2. One hidden component (TLS Runtime 3.0) was revoked with an opaque tombstone.
   **The firmware root came back byte-identical; only the component root moved.**
3. The clean device re-attested successfully; the secretly dependent device could not build a
   proof at all (`ContractRuntimeError`, nothing submitted).
4. **Consensus rejection verified:** a proof built before the revocation was submitted after it
   and the node refused the transaction (`1010: Invalid Transaction: Custom error: 104`). The
   revocation is enforced by the chain, not by our service.

## Ready to film — the chain is in a clean demo state
**Epoch 28, all components approved, both devices COMPLIANT.** The demo can be run from the top.
The operator service is **not** left running (it dies with the session, and every start costs one
~10-minute wallet sync). Start it yourself and wait for `operator service on ...`. To film:
```
docker start nightseal-proof-server      # from WINDOWS, not WSL
npm run serve                            # wait for "operator service on ..."; open :8787
```
Follow [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). Use the **"Revoke + replay stale proof"**
button for beat 2/3b — it revokes and then gets refused by the ledger in one action.

**To reset between takes:** `curl -X POST http://localhost:8787/api/approve` (republishes
everything, restoring the revoked component; epoch bumps by 6), then attest both devices.

## Hard-won infrastructure knowledge (do not regress)
1. **Duplicate WASM runtime broke every live transaction.** `compact-runtime` accepts `^3.0.0`
   (npm hoisted 3.1.0) while `midnight-js-protocol` pins 3.0.0 → two `StateValue` classes →
   `expected instance of StateValue` on every `callTx`. Deploys and simulator tests never cross
   that boundary, so tests passed while the chain path was broken. Fixed with a root `overrides`
   pin + `npm dedupe`. Verify: `npm ls @midnight-ntwrk/onchain-runtime-v3` → exactly one version.
2. **Private-state scoping:** the level provider throws unless `setContractAddress()` is called
   before any state access. `joinRegistry` does it.
3. **Holding a balanced transaction starves the next one of DUST.** The replay feature captures
   at `balanceTx` (proven but unbalanced) and balances only after the revocation.
4. **Deploy-then-bootstrap in one process hits indexer lag.** Wait a minute, then
   `npm run cli -- approve` (idempotent).
5. Every wallet process re-syncs Preview from genesis (~10 min). Drive the lifecycle over HTTP
   against one warm `serve` process — never with repeated CLI commands.

## Gotchas
- Invoke WSL as `wsl.exe -d Ubuntu bash -lc '<cmd>'`; the direct form can return empty output.
- Docker runs on the **Windows** engine only; the `docker` CLI does not exist inside WSL.
- WSL `/tmp` does not survive VM restarts — keep logs in `/root/nightseal/logs/` (gitignored).
- Never commit `.env` (WSL-only, gitignored, survives `git reset --hard`).
- Redeploy the public dashboard with `vercel deploy --prod --yes` from the Windows checkout.
