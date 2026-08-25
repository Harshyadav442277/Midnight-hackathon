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

Action: in the operator-only panel, click **Revoke component (CVE)** on *TLS Runtime 3.0*.

- The baseline epoch strip **flashes amber** and increments.
- The **component root changes while the firmware root stays exactly the same**. Say this out loud; it is the flagship visual.
- Every attested device drops to **RE-ATTESTATION REQUIRED** with a drift count. Say why: the baseline moved, so nobody has proved anything against the new root yet.
- Cut to the explorer: **the root-update transaction**. Linger here — it is the difference between a described lifecycle and an implemented one.

Say:

> "The chain sees the policy root move, but the same opaque update could be an approval, revocation, or cover rotation. It does not learn which firmware contains the component; the proof circuit discovers the blast radius privately."

---

## 2:00–2:35 — Beat 3: one recovers, one cannot

Action: click **Attest now** on *Sensor gateway · 02* → back to **green**.

Action: click **Attest now** on *Router · fleet-07* → it goes **red, NON-COMPLIANT**.

Say the important sentence:

> "The failed device's firmware leaf is still approved. The service is not consulting a CVE list: the local prover cannot obtain a path from one bound component to the current component root, so cryptography prevents it from constructing a valid proof."

Point at the red card's own note: nothing was written on-chain, because proving *non*-membership is exactly what this design refuses to do.

---

## Beat 3b (~15s) — the chain itself refuses a stale proof

Use the **Revoke + replay stale proof** button on *TLS Runtime 3.0* instead of the plain revoke
button. It proves an attestation while the component is still approved, revokes the component,
then submits that now-stale proof for real.

> "One more thing. This proof was generated *before* the revocation, and it is perfectly valid —
> it honestly proves a path to the roots that existed a moment ago. We submit it anyway. The
> Midnight ledger re-checks those roots against the present and refuses it. That rejection is
> not our server's opinion. It is consensus."

Show the rejection in the transaction log panel. This is the strongest evidence in the demo:
the failure is produced by the chain, with no application logic involved.

---

## 2:35–3:00 — The boundary, and close

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
- [ ] **Red NON-COMPLIANT card** with its note (multiple takes)
- [ ] Architecture diagram still
- [ ] Contract address on screen
- [ ] Device-bound proof label visible on a green card
