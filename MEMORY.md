# MEMORY — session continuity

## Current status (2026-08-25, ~15:40 IST)
- Deadline: 2026-08-27 07:00 IST. Student eligibility confirmed.
- Canonical build checkout: WSL Ubuntu at `/root/nightseal`; Windows workspace is synced.
- Toolchain green: Compact CLI 0.5.2 / compiler 0.31.1, proof server 8.1.0,
  Node 24.19. Full Compact proving-asset compile succeeds.
- Upgrade implemented:
  1. **Flagship:** firmware commitments bind private three-component manifests; a
     component tombstone changes only the component root and selectively destroys
     dependent firmware's ability to prove.
  2. **Secondary:** `deviceId -> H(deviceSecret)` registration; the same attest circuit
     proves knowledge of the enrolled device secret.
  3. **Stretch:** approval, tombstone revocation, and cover rotation share opaque
     `updateFirmwareLeaf` / `updateComponentLeaf` circuit shapes.
- Contract, CLI, and UI typecheck; 11/11 tests pass; production UI builds. Browser QA
  confirmed component root changes while firmware root stays fixed, clean recovery,
  selective red failure, and no console errors. Vite dependencies were aligned to 8.2.2.
- `docs/SUBMISSION.md` and `docs/DEPLOYMENT_RUNBOOK.md` are ready so the funded
  deploy, evidence capture, recording, and Devpost handoff can proceed without redesign.
- Upgrade commits in the Windows workspace: `ac8bbdb` (cryptographic capability
  upgrade) and `5e6d286` (deployment/submission handoff). The user-owned untracked
  `docs/improvementsByClaude.md` was preserved unchanged.

## Funding received; DUST and deployment still pending
- Faucet transaction submitted and confirmed by the fully synchronized wallet:
  `00388f16d712bd60fa0984f95afd76a803f938d59c61000a66194591fa52dbfc35`.
- Wallet balance at 15:36 IST: `NIGHT: 5000000000` (5,000 tNIGHT base units),
  `DUST: 0`.
- DUST registration was **not** submitted before handoff. No deploy or lifecycle
  transaction has been attempted.
- A final `docker start nightseal-proof-server` attempt failed because the `docker`
  command is currently unavailable inside WSL. Check `curl http://localhost:6300/`
  first; if unavailable, open Docker Desktop and enable Ubuntu WSL integration, then
  start/recreate the proof-server 8.1.0 container.
- No wallet sync, CLI, or other process was left running at handoff.

## Immediate continuation
1. From `/root/nightseal`, verify the proof server with `curl http://localhost:6300/`;
   restore Docker Desktop/WSL integration if that fails.
2. Run `npm run cli -- dust` (the ephemeral wallet performs a full Preview rescan),
   save the DUST-registration tx id, then run `npm run cli -- balance` until DUST > 0.
3. Run `npm run cli -- deploy`; paste the address/explorer link into README.
4. Run attest → `revoke-component tls-3.0-cve` → clean attest → affected attest;
   record hashes/errors in `docs/EVIDENCE.md` and capture raw footage.
5. Record the revised ~3-minute demo, deploy the read-only dashboard, submit Devpost.

## Gotchas
- A failed post-revocation attest normally stops during local witness/path resolution;
  the service records the attempt for the red card. Do not call it an on-chain failure.
- The on-chain evidence is two roots + epoch + stale device epoch; operation-hiding
  updates conceal approve vs. tombstone vs. cover, not all timing correlation.
- Never commit `.env`. The provisioning seed makes device secrets unguessable from ids.
- WSL git credential helper may be required for push (see prior history).
