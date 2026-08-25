# Improvements by Claude — second-pass audit (after the Codex upgrade)

*Written 2026-08-25. Inputs: the full working tree including the uncommitted upgrade diff,
[INNOVATION_AUDIT.md](INNOVATION_AUDIT.md), README, ARCHITECTURE, GAPS, BUILD_BRIEF,
`nightseal.compact`, `witnesses.ts`, the CLI/service/UI layers, and the 11-case test suite.*

## STATUS (updated 2026-08-25 evening — supersedes §3's sequencing)

| Candidate | State |
|---|---|
| **A. Silent revocation** | ✅ **Implemented** — `updateFirmwareLeaf` / `updateComponentLeaf` with `randomBytes(32)` tombstones are live in the contract, CLI, and tests. |
| **§1 honesty findings + §4 checklist 1–5** | ✅ Done — README attack map, capacity note, softened overclaim, decision-6 wording, unlinkability paragraph all landed; decision 7 fixed this session. |
| **B. Consensus-level rejection evidence** | ✅ **Implemented** — `replay` CLI verb, `/api/replay/:device/:component` route, and a dashboard control. Capture happens at `balanceTx` (proven but *unbalanced*), because a balanced held transaction reserves the wallet's DUST and starves the revocation that must follow — that was a real failure on first run. |
| **C. Split-authority cascade** | ⬇️ Demoted to **post-hackathon**: it reopens the contract while the deploy gate is the whole ballgame, and A already banks the silent-revocation story. Narrate it as the production profile instead. |
| **D. Vendor-blind approvals / E. Break-glass reveal** | Optional quick wins, only with clear margin after the video exists. |
| **§4 items 6–8** | Item 8 (record the failed attempt in EVIDENCE.md) folds into the deploy runbook; items 6–7 optional. |

**How B was actually built** (the sketch below was close, but the capture point moved):
intercept `walletProvider.balanceTx`, not `midnightProvider.submitTx`. Proving happens before
balancing, so the intercepted `UnboundTransaction` already carries the proof and the pre-revocation
roots in its transcript, while no DUST is committed yet. Throwing from the interceptor ends the
`callTx` cleanly. Then: revoke the component, and only afterwards balance and submit the held
transaction. The ledger replays the transcript against present state, its own `checkRoot` query
answers differently than recorded, and consensus rejects the transaction.

Capturing at `submitTx` — the original sketch — fails on a live network: the finalized transaction
reserves the wallet's only DUST output, and the revocation that has to happen next dies with
`Insufficient Funds: could not balance dust`.

**Scope discipline:** nothing below may run before the deployment gate is dead
(faucet → `deploy` → lifecycle tx hashes → raw footage). Every candidate is tagged
**contract-touching** or **deploy-safe** so it can be sequenced against that gate.

---

## 1. Verdict on the current state

The Codex selections are sound and genuinely implemented: cascading private component
revocation (two current-only trees, manifest bound inside the firmware commitment),
device-bound proof-of-possession, and epoch-relative staleness. The adversarial tests
(impersonation, component substitution, root replay, secrecy serialization) are the right
ones. Do not relitigate any of that.

What the second pass found is one recurring theme:

> **The cryptography is now stronger than the evidence and metadata story wrapped around
> it.** The chain still leaks *that* and *when* a revocation happened, and the demo's red
> card is still produced by the operator service, not by the ledger. Both are fixable
> cheaply, and both fixes deepen exactly the property the project is proudest of.

Three specific honesty findings, before the candidates:

1. **The README overclaims one sentence.** "The chain does not know which firmware
   contains this component" is true of *contents* but not of *events*: `revokeComponent`
   is its own exported circuit, its only argument is a leaf index, and it writes the
   default (zero) leaf. Any observer sees "a component revocation happened at time T at
   leaf k" — and can then watch which devices never re-green. Timing + blast-radius
   metadata leak today. Candidate A below closes most of this; until it lands, soften
   that sentence to "never learns which component or which firmware — only that the
   baseline moved."
2. **ARCHITECTURE decision 6 and DEMO_SCRIPT beat 3 disagree with GAPS and the code.**
   Decision 6 defines red as "re-attestation attempted and the proof **rejected
   on-chain**"; the script says "It is not being rejected by our backend." In the
   implementation, a post-revocation attest dies **client-side** in
   `witnesses.ts` (`findPathForLeaf` returns undefined → throw → the service's
   `attempts` map paints the card). GAPS states this correctly. Either implement
   candidate B (which makes the strong wording true) or align decision 6 and the
   script's sentence with GAPS. A judge who reads both will notice.
3. **The strongest evidence beat was dropped.** BUILD_BRIEF §6 required "Beat 3: replay
   rejected — the device replays its old proof against the new root — rejected
   on-chain." The current DEMO_SCRIPT has no replay beat, and `lastPath` (kept in
   private state *specifically* "so the demo can replay a stale proof") is written but
   never read. Candidate B restores this as the money shot.

Minor doc drift, fix when convenient: CLAUDE.md still says "9 lifecycle tests" (now 11).

---

## 2. Extra candidates, ranked

Same rubric and convention as INNOVATION_AUDIT.md (1–5; **for risk, 5 is worst**).
Every entry answers: *what security/privacy property becomes possible that was
impossible before?*

| Rank | Candidate | New property | Novelty | Midnight necessity | Demo impact | Risk | Contract? |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | **A. Silent revocation** (operation-hiding baseline updates + tombstone leaves) | Revocation becomes *publicly enforceable but privately triggered*: observers cannot tell an approval, a revocation, and a cover rotation apart — the chain enforces a revocation it cannot even see. | 5 | 5 | 4 | 2 | **contract-touching** |
| 2 | **B. Consensus-level rejection evidence** (held-transaction stale replay) | The FAIL state stops being a service record: a real proof, valid against yesterday's root, is refused by the **ledger** at apply time — evidence a skeptic cannot attribute to app logic. | 3 | 5 | 5 | 2 | deploy-safe |
| 3 | **C. Split-authority cascade** (separate component-authority key) | Cross-organization revocation without shared visibility: a regulator persona revokes one component capability and vendors' secretly-dependent firmware dies — no vendor disclosed its composition to the regulator. | 4 | 4 | 4 | 2 | **contract-touching** |
| 4 | **D. Vendor-blind approvals** (workflow only) | The operator approves builds *it cannot read* — closes the biggest self-disclosed trust gap ("the registry operator learns the firmware measurements") with zero contract change. | 3 | 3 | 2 | 1 | deploy-safe |
| 5 | **E. Break-glass selective disclosure** (CLI verb + README section) | Accountable privacy: under legal demand the operator reveals the opening of exactly one leaf, and anyone can verify it against ledger history — privacy from the public, not from due process. | 3 | 4 | 3 | 1 | deploy-safe |

### A. Silent revocation — flagship extra

**What leaks today.** Three separate signals distinguish revocation from approval on
the public chain: (1) each exported circuit is its own entry point, so the transaction
identifies *which* circuit ran; (2) `revokeComponent(index)` / `revokeFirmware(index)`
take an index only, while approvals carry a commitment — different public argument
shape; (3) `insertIndexDefault` writes the all-zero default leaf, which is visibly a
tombstone. Observers therefore get a **CVE weather-vane**: the exact moment a vendor
has a security incident, which leaf was pulled, and (by watching statuses) roughly how
wide the blast radius is.

**Mechanism.** Collapse each tree's approve/revoke pair into one circuit:

```compact
export circuit updateFirmwareLeaf(value: Bytes<32>, index: Uint<64>): [] {
  assert(operatorPk == operatorIdentity(localSecretKey()), "not the registry operator");
  approvedSet.insertIndex(disclose(value), disclose(index));
  baselineEpoch.increment(1);
}
// approve = updateFirmwareLeaf(realCommitment, i)
// revoke  = updateFirmwareLeaf(freshTombstone, i)
// rotate  = updateFirmwareLeaf(freshTombstone, unusedIndex)   // cover traffic
```

(and identically `updateComponentLeaf`). A **tombstone** is 32 fresh random bytes whose
opening nobody holds (equivalently: a domain-separated `persistentCommit` whose
randomness the operator discards). Because commitment outputs are uniform-looking, a
tombstone is indistinguishable from a genuine leaf; because no opening exists under the
`nightseal:firmware:`/`nightseal:component:` domain tags, it can never satisfy
`attest`. `insertIndexDefault` is no longer used. The CLI keeps its
`approve`/`revoke`/`rotate` verbs — they just all call the same circuit.

**What becomes hidden:** whether any given update was an approval, a revocation, or
noise; the count of live vs. dead leaves (baseline size and churn); and — with
occasional cover rotations — even the *timing* of real revocations, which disappear
into routine maintenance traffic. Cover rotations double as a **freshness heartbeat**:
each one bumps the epoch, forcing periodic re-attestation, which turns compliance from
point-in-time into continuous without adding any clock to the circuit.

**What stays visible (state honestly in GAPS):** the updated leaf *index* is still in
the public transcript, and per-device status dynamics still leak correlation (devices
that fail together probably share a component). The first is minor once the operation
type is hidden; the second is inherent to the deliberate public per-device dashboard.

**Test to add (this is demo material in itself):** build an approval tx and a
revocation tx in the simulator, serialize both public transcripts, and assert they are
structurally identical — same circuit, same shape, only opaque bytes differing.

**Demo line:** put both transactions on the explorer side by side — "One of these
approved a build. One revoked a component under an active CVE. You cannot tell which —
and the affected device is already red."

**Risks.** Requires re-verifying two Midnight facts against live docs before coding
(standing order 5): that call transactions identify the invoked circuit (this is why
the merge is needed at all), and `insertIndex` semantics for overwriting an occupied
index. Contract change ⇒ only worth doing **before** the first real deployment, or not
at all this week (see §3).

### B. Consensus-level rejection evidence — secondary extra

**The weakness.** Today's red card is the operator service's memory of a client-side
witness throw. The cryptographic *reason* is real (no valid path exists), but the
*evidence* is application state — the exact thing the judging prompt warns about
("demo outcome caused by cryptography, not backend/UI logic").

**Mechanism (no circuit change).** Exploit in-flight invalidation, which plain
`MerkleTree.checkRoot` provides by design:

1. Build the vulnerable device's attestation transaction **before** the revocation
   (valid proof against the current root) and hold it unsubmitted.
2. Operator revokes the component; roots move.
3. Submit the held transaction. The proof still verifies — it honestly proves "this
   path hashes to root R_old" — but the ledger's `checkRoot` comparison fails at apply
   time. **The chain, not the service, refuses it.**

Surface the node's rejection verbatim on the red card ("rejected by the Midnight
ledger: root mismatch") and record the attempt in docs/EVIDENCE.md next to the
lifecycle hashes. This restores BUILD_BRIEF's dropped beat with stronger evidence than
the original: the device replays *its own genuine yesterday-proof* and consensus says no.

**Implementation notes.** Needs the midnight-js lower-level path that separates
build/prove from submit (the providers expose proof generation and tx submission
separately; verify the exact API before promising the beat). Extend
`NightSealPrivateState` to cache component paths alongside `lastPath`, or simpler:
build the full tx object pre-revocation and hold it. **Fallback if the API fights
back:** keep today's flow but classify the error precisely on the card ("no Merkle
path to the current component root exists — proof construction is impossible") and fix
the two wording mismatches from §1. Honest either way; the held-tx variant is the one
worth 30 seconds of video.

**Demo line:** "We didn't fail to build a proof — we submitted a perfectly valid one.
The ledger checked it against the present and refused."

### C. Split-authority cascade — stretch

**Today** one `operatorPk` governs firmware, components, and enrollment (GAPS calls
this out). **Change:** a second app-level identity, `componentAuthorityPk`, set at
deployment (constructor argument), required by `updateComponentLeaf`; the vendor
operator keeps firmware + devices. App-level keys are free — both personas can pay
fees from the same funded wallet, so this needs **no second faucet visit**.

**New property:** an industry regulator (CERT persona) revokes one opaque component
capability; every vendor's secretly-dependent firmware loses provability; the
regulator never learns which vendors were affected, and no vendor ever disclosed its
composition. This upgrades NightSeal from single-tenant registry to **industry
revocation fabric** in ~10 contract lines, one extra seed, and one relabeled button.

**Demo line:** "CERT-In pulls the TLS library. The vendor never told CERT-In they used
it. Their fleet goes red anyway — cryptography routed the revocation."

Contract-touching ⇒ same sequencing rule as A. If both A and C are attempted, C's key
check lives inside A's merged component circuit — do them together, not sequentially.

### D. Vendor-blind approvals — quick win

`approveFirmware` already takes an opaque commitment, so this is CLI/workflow only: a
`vendor` persona computes measurement, randomness, manifest, and commitment locally and
hands the operator *only* the commitment + index; devices get their opening bundle from
the vendor. The operator provably cannot read what it approves. Deletes the largest
standing GAPS entry ("the registry operator learns the firmware measurements") and
upgrades the README trust-model paragraph. Invisible in the video; strong in the README.

### E. Break-glass selective disclosure — quick win

Commitments are binding, so the operator can — under legal demand — publish
`(measurement, manifest, randomness)` for exactly one leaf, and anyone can recompute
the commitment and match it against ledger history. Nothing else leaks. One CLI verb
(`reveal <build>` printing the opening + recomputed leaf) and one README paragraph.
This is Midnight's own "selective disclosure" pitch made concrete, and it pre-empts the
obvious judge question *"what if law enforcement needs to know?"* with: "targeted,
verifiable disclosure of one build — never a bulk dump."

---

## 3. Selection and sequencing against the deadline

**Flagship extra: A. Secondary: B. Stretch: C.** D and E land whenever there is idle
time; they risk nothing.

The deployment gate changes what is rational, so use decision rules, not a fixed plan:

- **If the contract is not yet deployed when work resumes** (current state: faucet
  blocked): implement **A** first — it is ~1–2 hours including tests, and it must ride
  the *first* deployment to be free. Add C's key check inside the same edit only if the
  clock comfortably allows. Then deploy once, capture the lifecycle evidence, and never
  touch the contract again.
- **If a deployment + footage already exist**: leave the contract alone. A redeploy
  would orphan recorded evidence and burn re-shoot time — A becomes a documented
  "production profile" paragraph instead of code. Spend the hours on **B** (deploy-safe,
  biggest video payoff), then D/E and §4.
- **Hard stop:** BUILD_BRIEF's contingency stands. At T-24h with no deployment, all of
  this yields to thin-but-deployed.

Positioning sentence once A + B exist (use in README + video close):

> **NightSeal revokes in silence: the chain enforces a revocation observers cannot even
> detect, and refuses yesterday's proof by consensus — not by anyone's backend.**

---

## 4. Checklist-tier fixes (each ≤ 15 minutes, all deploy-safe)

1. **Resolve the §1 wording mismatch** (ARCHITECTURE decision 6 + DEMO_SCRIPT beat 3 vs
   GAPS) — via B, or by softening two sentences.
2. **Soften the one overclaiming README sentence** (§1.1) until A lands.
3. **State tree capacity**: `MerkleTree<10, Bytes<32>>` = 1,024 leaves per set; depth is
   a compile-time knob. One line in README's scalability story — the rubric has a 10%
   axis with nothing currently aimed at it.
4. **Attack-map table in the README**: one row per adversarial test — *impersonation ·
   component substitution · clean-component swap-in · pre-CVE root replay · unapproved
   firmware · rogue operator · secrecy serialization* — each mapped to the attack it
   kills and its test name. Turns the suite into a security argument a generalist judge
   can read in 20 seconds.
5. **Claim an already-true, unclaimed property**: attestations disclose only the
   current roots, so two devices on the same build are *unlinkable on-chain* — the
   chain cannot cluster the fleet by firmware. (Caveat honestly: post-revocation
   failure timing still correlates; that is the §2.A note.)
6. **`deregisterDevice(deviceId)`** — decommission/lost-secret story (operator-only map
   removal; verify the ledger `Map` remove op exists in the stdlib). Also note
   explicitly that `registerDevice` overwriting an existing id is the intended re-key
   path. *(Contract-touching — only alongside A, else document as production profile.)*
7. **Crown-jewels note in GAPS**: `fleet.json` + `.env` (measurements, randomness,
   indices, provisioning seed) are the operator-side secret store; production would
   vault them. One honest line.
8. **docs/EVIDENCE.md** (already in TASKS): include the *failed* replay attempt's error
   alongside the success hashes — the rejection is evidence, treat it as such.
9. **CLAUDE.md test count** 9 → 11.

---

## 5. Rejected as extras (so future sessions don't relitigate)

- **Fleet-level threshold proof** — reclassify from "stretch" to **post-hackathon**,
  and for a sharper reason than risk: with the deliberately *public* per-device status
  map, any aggregate is already computable by anyone, so a ZK threshold proof adds no
  property until the whole status model goes confidential. That is a different product.
- **Epoch nullifiers / anti-double-attest** — same-epoch duplicate attestation is an
  idempotent rewrite of identical values; it grants nothing. (Third-party replay of a
  captured attest tx is likewise harmless — worth one GAPS line, not a mechanism.)
- **Rotating unlinkable device ids** — still conflicts with the public dashboard MVP;
  Codex's rejection stands.
- **Compliance TTL via a clock** — Compact circuits have no time source; the honest
  version of "freshness" is A's cover-rotation heartbeat, already counted there.
- **Historic-root grace window** — would re-admit revoked proofs; the plain-MerkleTree
  choice *is* the product (ARCHITECTURE decision 2).
- **Multisig / governance for the operator key** — governance theater at this scale;
  the single-key limitation stays a disclosed GAPS line. C is the meaningful version.
- **Non-membership proofs, SBOM depth, aggregation, AI/tokens/NFT/IPFS/TEE/PQ** — all
  remain excluded; no new property under this threat model.

---

## 6. Verify against live docs before building (standing order 5)

| Claim assumed above | Needed by | Check |
|---|---|---|
| Call txs publicly identify the invoked circuit (per-circuit verifier keys) | A (its whole rationale) | docs.midnight.network — transaction structure / contract calls |
| `insertIndex` may overwrite an occupied leaf; `insertIndexDefault` writes the default value | A | Compact ledger ADT reference |
| midnight-js can build+prove a call tx and submit it later (separate steps) | B | midnight-js contracts / providers API |
| Failed apply surfaces a distinguishable node error (and whether the explorer shows failed txs at all) | B | node/indexer behaviour on Preview |
| Compact `constructor` accepts arguments (for `componentAuthorityPk`) | C | Compact language reference |
| Ledger `Map` supports removal | §4.6 | Compact ledger ADT reference |

If any check fails, the affected candidate degrades to its documented-fallback form
noted inline; nothing above is load-bearing for the mandatory submission.
