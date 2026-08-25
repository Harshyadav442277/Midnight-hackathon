# NightSeal deployment evidence

## Deployment gate

| | |
|---|---|
| Network | Midnight Preview |
| Funding address | `mn_addr_preview14066huxp7t3rjx85pkptfgcntcny8ul0tjx8q0dl4d838gnwu2psw8jw44` |
| Faucet transaction | `00388f16d712bd60fa0984f95afd76a803f938d59c61000a66194591fa52dbfc35` (confirmed 2026-08-25 ~15:30 IST) |
| Wallet balance | `NIGHT: 5000000000` (5,000 tNIGHT base units), `DUST: 0` at funding time |
| DUST registration | submitted 2026-08-25 evening — tx id in MEMORY.md; recheck with `npm run cli -- balance` |
| Proving assets | regenerated 2026-08-25 (~27 MB keys for all four circuits) |
| Contract | pending DUST accrual + `npm run cli -- deploy` |

## Live lifecycle (fill immediately after funding)

| Beat | Expected cryptographic state | Transaction / evidence |
|---|---|---|
| Deploy + bootstrap | registered device commitments; firmware and component roots populated | pending |
| PASS | registered identity + firmware + three components prove current | pending |
| Opaque component update | component root and epoch move; firmware root stays unchanged | pending |
| Clean recovery | unaffected device re-attests at new epoch | pending |
| Selective FAIL | affected device cannot resolve a current component path; no tx is submitted | pending error capture |

## Verified local evidence

- `npm run compact` — full proving/verifying assets generated successfully.
- `npm run typecheck` — contract, CLI, and UI clean.
- `npm test` — 11/11 lifecycle and adversarial tests pass.
- `npm run build --workspace ui` — production build succeeds.
- In-app browser QA — firmware root remained fixed across component revocation; component
  root moved; clean device recovered; secretly dependent device became NON-COMPLIANT;
  no browser console errors.
