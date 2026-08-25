# NightSeal deployment evidence

## Deployment gate

| | |
|---|---|
| Network | Midnight Preview |
| Wallet sync | complete; balance rechecked 2026-08-25 15:05 IST |
| Wallet balance | `NIGHT: 0`, `DUST: 0` |
| Funding address | `mn_addr_preview14066huxp7t3rjx85pkptfgcntcny8ul0tjx8q0dl4d838gnwu2psw8jw44` |
| Faucet | https://midnight-tmnight-preview.nethermind.dev/ |
| Contract | pending faucet funding |

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
