# DEMO_SCRIPT — ~3 minutes, four beats

Film the dashboard and the block explorer **side by side** for the whole middle section. Record each beat as soon as it works; do not bet the submission on one final take.

**Setup before recording**
```bash
docker start nightseal-proof-server
npm run serve                      # http://localhost:8787
```
Browser left: the dashboard. Browser right: the contract on `preview.midnightexplorer.com`.

**Timing, measured on Preview — plan your edit around it.** Every action generates a real ZK
proof and waits for the transaction, so nothing is instant:

| Action | Roughly |
|---|---|
| `npm run serve` startup (wallet re-syncs from genesis) | ~10 min — start it well before you record |
| Attest one device | 30–60 s |
| Revoke a component | ~20 s |
| Revoke + replay stale proof | ~70 s (proves, revokes, then submits) |

Record continuously and cut the waits in the edit, or narrate over them — the pauses are honest
proof generation, not lag. **Do not** start recording until the service prints
`operator service on http://...`.

**To reset between takes** (restores the revoked component so the demo runs again):
```bash
curl -X POST http://localhost:8787/api/approve
```
then attest both devices back to green. This takes a few minutes; it does not need a redeploy.

No unexplained acronym before 1:00. "SBOM" and "CVE" are only allowed after the stake lands.

---

## 0:00–0:20 — The stake

Over the dashboard header:

> "Your router's manufacturer must prove its firmware is clean — without publishing a map of its insides for attackers."

Then: regulators demand proof of firmware provenance; manufacturers cannot afford the disclosure that proof normally requires; zero knowledge is the only thing that satisfies both at once.

---

## 0:20–1:00 — Beat 1: it passes

Action: click **Attest now** on *Sensor gateway · 02*.

- The button reads "Generating proof…" — say that the proof is being built locally, on the device side of the line.
- The card turns **green — COMPLIANT**, epoch matching the baseline.
- Cut to the explorer: the transaction is there.

Point to the device-bound label and the two roots. One proof established three things:
the prover knows this registered device's secret, the hidden firmware is current, and
all components privately bound into it are current.

Say, over the explorer view:

> "The chain shows a yes. It never shows the firmware."

Scroll the public state on screen: a device id, a status, an epoch, a Merkle root. No hash, no version, no supplier.

---

## 1:00–2:00 — Beat 2: the CVE, and the money shot

> "A vulnerability lands in a component used by an unknown subset of firmware."

Action: in the operator-only panel, click **Revoke + replay stale proof** on *TLS Runtime 3.0*.

> **Use this button, not the plain "Revoke component (CVE)" one.** It does the revocation *and*
> the consensus rejection in a single ~70-second action, which is why beats 2 and 3b run in one
> pass. The plain revoke button is the simpler alternative, but demonstrating the replay
> afterwards would need a full reset first — the component would already be gone, so no
> pre-revocation proof could be built.

While it runs (narrate over the wait):

- The baseline epoch strip **flashes amber** and increments.
- The **component root changes while the firmware root stays exactly the same**. Say this out loud; it is the flagship visual.
- Every attested device drops to **RE-ATTESTATION REQUIRED** with a drift count. Say why: the baseline moved, so nobody has proved anything against the new root yet.
- Cut to the explorer: **the root-update transaction**. Linger here — it is the difference between a described lifecycle and an implemented one.

Say:

> "The chain sees the policy root move, but the same opaque update could be an approval, revocation, or cover rotation. It does not learn which firmware contains the component; the proof circuit discovers the blast radius privately."

Then the transaction log line lands — that is beat 3b below.

---

## 2:00–2:20 — Beat 3: the chain itself refuses a stale proof

Still the same click. Before revoking, it proved an attestation while the component was still
approved; after revoking, it submitted that now-stale proof for real. The log line lands:

> *Router · fleet-07: stale proof REJECTED by the Midnight ledger*

and the device card turns red reading **"Rejected by consensus, not by this dashboard."**

Say:

> "That proof was generated *before* the revocation, and it is perfectly valid — it honestly
> proves a path to the roots that existed a moment ago. We submitted it anyway. The Midnight
> ledger re-checked those roots against the present and refused the transaction. That rejection
> is not our server's opinion. It is consensus."

This is the strongest evidence in the demo: the failure is produced by the chain, with no
application logic involved.

---

## 2:20–2:40 — Beat 4: one recovers, one cannot

Action: click **Attest now** on *Sensor gateway · 02* → back to **green, COMPLIANT** at the new epoch.

Action: click **Attest now** on *Router · fleet-07* → it stays **red**, and the card's note now
changes to the *local* failure: the proof could not even be built.

Say the important sentence:

> "The failed device's firmware leaf is still approved. The service is not consulting a CVE list: the local prover cannot obtain a path from one bound component to the current component root, so cryptography prevents it from constructing a valid proof."

Two different red states, and the card says which is which: one where the chain refused a proof,
one where no proof could exist. Neither is a backend deciding who passes.

---

## 2:40–3:00 — The boundary, and close

> "The hardware root of trust is the platform's job — measured boot and a TPM quote. Our contribution is the privacy-preserving transparency layer above it."

Flash `docs/architecture.svg` with the out-of-scope band visible. Then the deployed contract address on screen. Close on the stake line.

---

## Shot checklist

- [ ] Green COMPLIANT card, close up
- [ ] Explorer: attestation transaction
- [ ] Explorer: **root-update transaction** (the important one)
- [ ] Firmware root unchanged + component root changed, in the same shot
- [ ] Baseline epoch flash + all cards dropping to amber
- [ ] Green recovery on the unaffected device
- [ ] **Log line: "stale proof REJECTED by the Midnight ledger"** (the strongest shot)
- [ ] **Red card reading "Rejected by consensus, not by this dashboard"**
- [ ] Red card again after a plain re-attest, now showing the *local* failure note
- [ ] Architecture diagram still
- [ ] Contract address on screen
- [ ] Device-bound proof label visible on a green card
