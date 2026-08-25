# DEMO_SCRIPT — ~3 minutes, three beats

Film the dashboard and the block explorer **side by side** for the whole middle section. Record each beat as soon as it works; do not bet the submission on one final take.

**Setup before recording**
```bash
docker start nightseal-proof-server
npm run serve                      # http://localhost:8787
```
Browser left: the dashboard. Browser right: the contract on `preview.midnightexplorer.com`.
If a previous take left devices attested, stand up a fresh registry with `npm run cli -- deploy`.

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

Say, over the explorer view:

> "The chain shows a yes. It never shows the firmware."

Scroll the public state on screen: a device id, a status, an epoch, a Merkle root. No hash, no version, no supplier.

---

## 1:00–2:00 — Beat 2: the CVE, and the money shot

> "A vulnerability lands in one of the approved firmware builds."

Action: in the operator panel, click **Revoke (CVE)** on *router-fw 2.3.9*.

- The baseline epoch strip **flashes amber** and increments.
- Every attested device drops to **RE-ATTESTATION REQUIRED** with a drift count. Say why: the baseline moved, so nobody has proved anything against the new root yet.
- Cut to the explorer: **the root-update transaction**. Linger here — it is the difference between a described lifecycle and an implemented one.

---

## 2:00–2:35 — Beat 3: one recovers, one cannot

Action: click **Attest now** on *Sensor gateway · 02* → back to **green**.

Action: click **Attest now** on *Router · fleet-07* → it goes **red, NON-COMPLIANT**.

Say the important sentence:

> "The revoked device isn't being turned away by our application logic. Its firmware commitment is no longer a leaf of the tree, so there is no Merkle path — it cannot construct a passing proof at all."

Point at the red card's own note: nothing was written on-chain, because proving *non*-membership is exactly what this design refuses to do.

---

## 2:35–3:00 — The boundary, and close

> "The hardware root of trust is the platform's job — measured boot and a TPM quote. Our contribution is the privacy-preserving transparency layer above it."

Flash `docs/architecture.svg` with the out-of-scope band visible. Then the deployed contract address on screen. Close on the stake line.

---

## Shot checklist

- [ ] Green COMPLIANT card, close up
- [ ] Explorer: attestation transaction
- [ ] Explorer: **root-update transaction** (the important one)
- [ ] Baseline epoch flash + all cards dropping to amber
- [ ] Green recovery on the unaffected device
- [ ] **Red NON-COMPLIANT card** with its note (multiple takes)
- [ ] Architecture diagram still
- [ ] Contract address on screen
