# NightSeal deployment evidence

## Deployment gate

| | |
|---|---|
| Network | Midnight Preview |
| Funding address | `mn_addr_preview14066huxp7t3rjx85pkptfgcntcny8ul0tjx8q0dl4d838gnwu2psw8jw44` |
| Faucet transaction | `00388f16d712bd60fa0984f95afd76a803f938d59c61000a66194591fa52dbfc35` (confirmed 2026-08-25 ~15:30 IST) |
| Wallet balance | `NIGHT: 5000000000` (5,000 tNIGHT base units), `DUST: 0` at funding time |
| DUST registration | `00f6f659fcb0560232f644416e0e48ad8ab328b570340fb642dbef04126d32ed3d` (submitted 2026-08-25 16:04 IST; recheck with `npm run cli -- balance`) |
| Proving assets | regenerated 2026-08-25 (~27 MB keys for all four circuits) |
| DUST accrued | `120739534999999999` base units at first post-registration sync (2026-08-25 ~16:15 IST) |
| **Contract (Preview)** | `160c6bfcd360c8806bea5d45740f45d80930482038f57e55b72f6d002bb0ef6e` — deployed 2026-08-25 ~16:16 IST |
| **Explorer** | https://preview.midnightexplorer.com/contracts/160c6bfcd360c8806bea5d45740f45d80930482038f57e55b72f6d002bb0ef6e |

## Bootstrap — all nine transactions confirmed on Preview (2026-08-25 11:18–11:22 UTC)

Baseline after bootstrap: **epoch 7**
· firmware root `1745636128736094226352452322422029702955587615436897047336384466937955749568`
· component root `39672010876196885146161952834607207542719471899791519010124305427177892939627`

| # | Operation | Transaction |
|---|---|---|
| 1 | registerDevice (Router · fleet-07) | `0664ad3feff3d170659d9d48554b5a6e8740495530d42e31c7ebc3cf9a0e7ee9` |
| 2 | registerDevice (Sensor gateway · 02) | `1455db113feeeffbf18ca85918cca85b969c69288144989877ca698ca3f983ee` |
| 3 | registerDevice (Edge camera · 11) | `882e05eda769182bdb6ec5c1b4b50eb8e24709c0f2c358b1bc1fd589fc585c81` |
| 4 | updateComponentLeaf (Secure Boot Core 6, leaf 0) | `d1bc66870d709c8df3b71c60cfa0837407627ed810a159b3c678067eb8a03100` |
| 5 | updateComponentLeaf (Linux LTS 6.12, leaf 1) | `dbb6d82f7705ef665e2904d94927f655b490ccbd3a2f04516ad44352b11d8dce` |
| 6 | updateComponentLeaf (TLS Runtime 3.4, leaf 2) | `8cf92a9b40e2435b634fbe5237baa0a486e8bed9175fda2aec42f62583b72ed2` |
| 7 | updateComponentLeaf (TLS Runtime 3.0, leaf 3) | `5b8fa58ca9b5a9f23ee3601996c1d049abef6f2f8cfeacb06739e754cbbe5baf` |
| 8 | updateFirmwareLeaf (clean build, leaf 0) | `fc3170171b7cc4370805e35bfcd82141a5950880c558168cbd778f7b21dd05e9` |
| 9 | updateFirmwareLeaf (vulnerable build, leaf 1) | `d9385546564147233c7cb5380fdba1a98ba2000c6e0cb31d667e070b09d94263` |

Note that transactions 4–9 are **indistinguishable in shape** from a revocation or a cover
rotation: every one is `update*Leaf(value, index)` carrying an opaque 32-byte value.

## Live lifecycle

Executed end to end against the live Preview registry on 2026-08-25 (11:32–11:47 UTC).

| Beat | Cryptographic state | Transaction / evidence |
|---|---|---|
| Deploy + bootstrap | registered device commitments; both capability roots populated | ✅ 9 transactions above, epoch 7 |
| PASS (clean device) | registered identity + firmware + three components all prove current | ✅ `73dea0b0f198c8033eb7e90f796b871819574bc2adc4a36869b264dcf95ab0e7` |
| PASS (device that secretly depends on TLS 3.0) | same three gates; nothing on-chain distinguishes it from the clean device | ✅ `c591dc427fe530c56661f0db56281a072134d01385e85c935c5c64d7fca43a99` |
| Opaque component update (the CVE) | component root and epoch move; **firmware root byte-identical** | ✅ `98d6a6ab5836e5212d663368cb571e99838fd139fbe65ae09915b9e64c0c1507` |
| **Consensus FAIL (replay)** | a proof valid against the pre-revocation roots, submitted after the roots moved, is **refused by the ledger** | ✅ rejected — node returned `1010: Invalid Transaction: Custom error: 104`; no transaction was recorded |
| Clean recovery | unaffected device re-attests against the new roots | ✅ `040fd591c82b0a0029893c4cd55650d85a20e2a451850a29b07340466560353d` |
| Selective FAIL | affected device cannot resolve a current component path, so no transaction can even be built | ✅ `ContractRuntimeError: Error executing circuit 'attest'` — nothing submitted |

### The invariant that carries the product

|  | Before the component revocation | After |
|---|---|---|
| Baseline epoch | 7 | **8** |
| Firmware capability root | `1745636128736094226352452322422029702955587615436897047336384466937955749568` | **identical — unchanged** |
| Component capability root | `39672010876196885146161952834607207542719471899791519010124305427177892939627` | **`26211678861062063100674004650701188971973021925824327902212782252686379995044`** |
| Router · fleet-07 (secretly depends on TLS 3.0) | COMPLIANT @ 7 | **stuck at epoch 7 — cannot prove** |
| Sensor gateway · 02 (clean) | COMPLIANT @ 7 | **COMPLIANT @ 8 — recovered** |

One component capability was replaced with an opaque tombstone. No firmware leaf was touched,
and the chain never learned which firmware contained that component — yet exactly the dependent
device lost the ability to prove compliance, and the clean one did not.

### Two distinct failure modes, deliberately

- **Selective FAIL** happens *before* a transaction exists: the prover cannot find a current
  Merkle path, so nothing is submitted. This is the honest everyday case, and the dashboard
  labels it as a local proof-construction failure.
- **Consensus FAIL (replay)** happens *on-chain*: a proof built moments earlier is submitted
  after the roots move, and the node rejects the transaction outright. This is the strongest
  evidence in the project — revocation enforced by consensus, not by application logic.

## Verified local evidence

- `npm run compact` — full proving/verifying assets generated successfully.
- `npm run typecheck` — contract, CLI, and UI clean.
- `npm test` — 11/11 lifecycle and adversarial tests pass.
- `npm run build --workspace ui` — production build succeeds.
- In-app browser QA — firmware root remained fixed across component revocation; component
  root moved; clean device recovered; secretly dependent device became NON-COMPLIANT;
  no browser console errors.
