# NightSeal — Devpost submission copy

Paste-ready, structured exactly like the Devpost form. Every link is live and verified;
only the demo-video URL is still missing.

## Project name

NightSeal

## Tagline (short description)

Firmware compliance as a revocable cryptographic capability on Midnight — devices prove their
hidden firmware and its hidden components are currently approved; a CVE removes that ability
without revealing what was affected.

---

# About the project

## Inspiration

Firmware security has a disclosure paradox. Regulators — CERT-In directions, NIST SP 800-193,
IEC 62443, EN 303 645 — increasingly demand *demonstrable* firmware provenance. But the obvious
way to demonstrate it, publishing firmware hashes and component inventories (SBOMs), hands
attackers a target map and leaks competitively sensitive supply-chain data. Every existing
answer picks a side: a public allowlist satisfies auditors by betraying vendors; a private
database protects vendors but asks auditors to just trust its operator.

The deeper inspiration was noticing that revocation is usually modeled *backwards*. Systems
mark things unsafe — a flag, a CRL entry, a status column — and then everyone must check the
flag, forever, and the flag itself reveals what was condemned. We wanted the inverse:
**compliance as a capability that can be cryptographically destroyed**. Nothing gets marked.
The revoked thing simply loses the mathematical ability to prove it belongs — and on a chain
like Midnight, nobody watching can even tell what was removed, or that a removal happened at all.

> Your router's manufacturer must prove its firmware is clean — without publishing a map of its
> insides for attackers.

## What it does

NightSeal is a privacy-preserving firmware attestation registry, deployed and verified on
Midnight Preview. One zero-knowledge attestation proves three things at once, atomically:

1. **I control this registered device** — the proof requires the device's enrolled secret, so
   Device A's valid proof can never authorize Device B;
2. **my hidden firmware is currently approved** — a Merkle membership proof against a
   current-only capability tree whose leaves are opaque commitments, never hashes;
3. **every component privately bound inside that firmware is also currently approved** — a
   second capability tree, checked in the same circuit, over a three-slot component manifest
   whose digest is sealed inside the firmware commitment itself.

That third gate is the flagship. When a CVE lands in one component, the operator replaces that
component's leaf with a random tombstone nobody can open. **The firmware tree is untouched —
we verified the root byte-identical on-chain — yet exactly the devices whose firmware secretly
contains that component lose the ability to prove compliance.** The blast radius is computed by
cryptography, not by a backend looking up a dependency database, and the chain never learns
which firmware was affected, or why.

Three properties make this more than a membership demo:

- **Silent revocation.** Approval, revocation, and cover rotation are the *same* circuit
  writing one opaque 32-byte value. An observer cannot distinguish a routine update from a
  CVE response — there is no "revocation event" to watch for. We test this indistinguishability
  explicitly.
- **Failure is a chain verdict, not an app decision.** A proof generated *before* a revocation
  — honest, fully valid — was submitted *after* it. The Midnight ledger re-checked the roots in
  its transcript against present state and refused the transaction outright. We demonstrate
  this live with one dashboard click.
- **The audit side needs no trust and no wallet.** The public dashboard
  ([nightseal.vercel.app](https://nightseal.vercel.app)) reads ledger state straight from the
  indexer: device id, status, epoch, two roots — and provably nothing else, because nothing
  else exists on-chain.

What is public: device id → identity commitment, compliance status, attested epoch, two Merkle
roots, opaque leaves. What is private, always: device secrets, firmware measurements, component
manifests, blinding randomness, Merkle paths, versions, SBOMs, suppliers.

## How we built it

- **Contract:** ~180 lines of Compact. Two current-only `MerkleTree<10, Bytes<32>>` capability
  sets; a device-identity map; four transaction circuits (`registerDevice`,
  `updateFirmwareLeaf`, `updateComponentLeaf`, `attest`) plus five pure helper circuits.
  Domain-separated `persistentCommit`/`persistentHash` bind a firmware measurement *and* its
  component-manifest digest into a single leaf commitment. We deliberately chose plain
  `MerkleTree` over `HistoricMerkleTree`: accepting only the *current* root is exactly what
  makes revocation destroy old capabilities.
- **Off-chain:** TypeScript witnesses resolve Merkle paths from public state while secrets stay
  in local private state; a headless-wallet CLI and a small operator service (plain `node:http`)
  drive deploy/approve/revoke/attest/replay; a React + Vite auditor dashboard shows both roots,
  epoch drift, and per-device state with an honest distinction between its data sources.
- **The replay mechanism** required no circuit change: we intercept the wallet's `balanceTx` to
  hold a fully *proven but unbalanced* transaction, move the baseline, then balance and submit
  it — letting consensus, not our code, reject it.
- **Verification:** 13 adversarial tests (impersonation, component substitution, root replay,
  rogue operator, secrecy serialization, approval/revocation indistinguishability), then the
  entire lifecycle executed on Midnight Preview with every transaction hash recorded in
  [docs/EVIDENCE.md](EVIDENCE.md).
- **Toolchain:** Compact compiler 0.31.1 under WSL, local proof server 8.1.0 in Docker,
  midnight.js 4.1.1, Vercel for the read-only dashboard (serverless function + the committed
  ledger decoder — no wallet, no seed, no proof server in the cloud).

## Challenges we ran into

**The bug our tests could not see.** Every simulator test passed while every live transaction
failed with `expected instance of StateValue`. Cause: npm resolved *two copies* of Midnight's
WASM onchain-runtime (one hoisted for `compact-runtime`'s `^3.0.0`, one pinned by
`midnight-js-protocol` at 3.0.0), producing two `StateValue` classes whose `instanceof` checks
reject each other — but only on the code path where indexer-deserialized state enters circuit
execution, which simulators and deploys never cross. One `overrides` pin fixed what hours of
staring at our own code could not.

**Holding a transaction starves the next one.** Our first replay implementation captured the
*finalized* transaction — which reserves the wallet's DUST, so the revocation that had to
happen next died with `Insufficient Funds`. The fix was conceptual, not mechanical: capture
*before* fee-balancing, hold a proven-but-unbalanced transaction, and attach fees only at
submission time.

**Ecosystem sharp edges, each now documented in the repo:** the indexer serves a freshly
deployed contract a beat *after* deployment confirms (the same-process bootstrap dies without a
retry); the private-state provider silently requires `setContractAddress()` before any access;
wallets re-sync Preview from genesis (~10 minutes) on every process start, which forced a
warm-service architecture where the demo runs over HTTP in seconds; and the Compact compiler
has no Windows build, so the project straddles Windows (Docker, editing) and WSL (compiling,
proving) with git as the only bridge.

## Accomplishments that we're proud of

- **The invariant, measured on a public network:** component root moved, firmware root
  byte-identical, and only the secretly dependent device lost the ability to prove — clean
  device recovered at the next epoch. Anyone can re-check every transaction hash.
- **A consensus-level rejection as a demo beat.** The ledger itself refusing a
  valid-moments-ago proof is the strongest evidence a revocation system can show, and it is one
  button in our dashboard.
- **Privacy that includes metadata.** Most ZK demos hide data but leak events. NightSeal's
  approvals and revocations are indistinguishable transactions — verified by a test that
  compares their public shapes.
- **Honesty as a feature.** No non-membership proofs, ever — so "device X failed" is never
  written on-chain, and the dashboard's two red states say exactly where each verdict came from
  (*the chain refused a proof* vs. *no proof could be built*). The repo keeps a standing
  limitations ledger (GAPS.md), including what we mock (hardware root of trust) and what still
  leaks (root movement and timing correlation).
- **A finished, reproducible system**: deployed contract, live public auditor URL, 13/13
  adversarial tests, one-command demo service, and paste-ready evidence.

## What we learned

- **Model revocation as capability destruction, not status marking.** It composes: one hidden
  component's removal cascades through a dependency graph the chain never sees.
- **Metadata is part of the privacy budget.** Hiding *what* changed is half the job; hiding
  *that* and *when* something changed is the other half, and circuit-shape design (one opaque
  update operation) is what buys it.
- **The witness boundary is the architecture.** Deciding early what may exist only in local
  private state — measurements, openings, paths, device secrets — dictated everything from the
  commitment scheme to why the proof server must stay local.
- **Simulators cannot vouch for the network boundary.** Version skew across WASM module
  instances broke only the live path. If it touches serialization or module identity, test it
  against the real chain.
- **ZK UX is latency choreography.** Proofs take 30–70 seconds; a demo survives only if the
  narration, the UI states, and the script are designed around honest waiting.

## What's next for NightSeal

- **Split-authority revocation:** give the component tree to a regulator/CERT key while vendors
  keep firmware and enrollment. A CERT revokes one hidden component capability and every
  affected vendor's firmware, industry-wide, loses provability — without any vendor disclosing
  its composition to the regulator. The contract shape already supports it.
- **Vendor-blind approvals:** vendors submit self-generated commitments so even the registry
  operator never learns firmware measurements (the contract already accepts opaque
  commitments; this is workflow, not circuit work).
- **Break-glass selective disclosure:** commitments are binding, so the operator can reveal
  exactly one leaf's opening to a court — verifiable against chain history, leaking nothing else.
- **Scale knobs:** larger bounded manifests and deeper trees (depth is a compile-time
  parameter), and a real measured-boot/TPM integration to replace the mocked device layer.
- **Fleet-level threshold proofs** ("≥98% compliant") — deliberately deferred until per-device
  status itself goes confidential; with today's public per-device dashboard the aggregate is
  already public, and we refused to ship decorative ZK.

---

# Built with

`midnight` · `compact` · `zero-knowledge-proofs` · `merkle-trees` · `typescript` · `midnight.js` ·
`node.js` · `react` · `vite` · `docker` · `vercel` · `vitest` · `wsl`

(Devpost tag field, comma form: midnight, compact, zero-knowledge-proofs, merkle-trees,
typescript, midnightjs, node.js, react, vite, docker, vercel, vitest)

---

# Try out links

1. **Live auditor dashboard (no wallet, no install):** https://nightseal.vercel.app
2. **Source:** https://github.com/Harshyadav442277/Midnight-hackathon
3. **Contract on the Preview explorer:** https://preview.midnightexplorer.com/contracts/160c6bfcd360c8806bea5d45740f45d80930482038f57e55b72f6d002bb0ef6e

Supporting links (use in the description if the form allows more):
- Deployment transaction (block #574,524): https://preview.midnightexplorer.com/transactions/e76877a2b543ccdb50c35416b605c26f4be4b67847b0602ae72795a548519a59
- Component-revocation (root-update) transaction: https://preview.midnightexplorer.com/transactions/98d6a6ab5836e5212d663368cb571e99838fd139fbe65ae09915b9e64c0c1507
- Attestation transaction: https://preview.midnightexplorer.com/transactions/73dea0b0f198c8033eb7e90f796b871819574bc2adc4a36869b264dcf95ab0e7
- Post-revocation recovery: https://preview.midnightexplorer.com/transactions/040fd591c82b0a0029893c4cd55650d85a20e2a451850a29b07340466560353d
- Full on-chain evidence: https://github.com/Harshyadav442277/Midnight-hackathon/blob/main/docs/EVIDENCE.md

---

# Project media

Captured images live in [`docs/media/`](media/) (all taken from the live system). Suggested
gallery order:

1. `replay-rejected.png` — **the money shot**: the red NON-COMPLIANT card reading "Rejected by
   consensus, not by this dashboard", epoch moved 21→22, firmware root visibly unchanged while
   the component root changed, the neighbor device amber.
2. `dashboard-live.png` — the public auditor view: both devices green, two roots, the
   "what this page can see" strip, footer links.
3. `operator-panel.png` — the private dependency view: four components with affects-counts and
   the revoke / replay controls the public page never gets.
4. `architecture.png` — the architecture diagram with the private/public line and the
   out-of-scope hardware band (2× render of docs/architecture.svg).
5. `explorer-contract.png` — the deployed contract on the public explorer: DEPLOYED badge,
   deployment tx, block #574,524.
6. `explorer-revocation-tx.png` — a revocation transaction on the explorer: SUCCESS, type
   REGULAR, opaque parameters — silent revocation, visible.
7. `evidence-github.png` — the on-chain evidence tables rendered on GitHub.

During video recording, also grab a still of the epoch strip flashing amber mid-action.

---

# Final submission checklist

- [x] Preview contract link resolves publicly.
- [x] Root-update transaction link resolves publicly.
- [x] Live dashboard link resolves publicly, read-only.
- [x] README contains contract, dashboard, and evidence links (video link still to add).
- [x] Public repository contains no `.env`, wallet seed, or private openings — verified.
- [x] Every explorer link verified to resolve (paths are `/contracts/` and `/transactions/`).
- [ ] Video shows firmware root unchanged while component root changes.
- [ ] Video shows the ledger rejecting the stale replay.
- [ ] Video link added here, to the README, and to the Devpost form.
