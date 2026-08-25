# MEMORY — session continuity

## Current status (2026-08-25, ~15:10 IST)
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

## Blocked on the only human step
- Preview wallet fully resynced and rechecked at 15:05 IST; it still reports
  `NIGHT: 0`, `DUST: 0`.
- Fund this unshielded address through the CAPTCHA faucet:
  `mn_addr_preview14066huxp7t3rjx85pkptfgcntcny8ul0tjx8q0dl4d838gnwu2psw8jw44`
- Faucet: https://midnight-tmnight-preview.nethermind.dev/
- Then run `npm run cli -- dust`, wait for DUST, and deploy.

## Immediate continuation after funding
1. `npm run cli -- dust` then `npm run cli -- balance` until DUST > 0.
2. `npm run cli -- deploy`; paste address/explorer link into README.
3. Run attest → `revoke-component tls-3.0-cve` → clean attest → affected attest;
   record hashes/errors in `docs/EVIDENCE.md` and capture raw footage.
4. Record the revised ~3-minute demo, deploy the read-only dashboard, submit Devpost.

## Gotchas
- A failed post-revocation attest normally stops during local witness/path resolution;
  the service records the attempt for the red card. Do not call it an on-chain failure.
- The on-chain evidence is two roots + epoch + stale device epoch; operation-hiding
  updates conceal approve vs. tombstone vs. cover, not all timing correlation.
- Never commit `.env`. The provisioning seed makes device secrets unguessable from ids.
- WSL git credential helper may be required for push (see prior history).
