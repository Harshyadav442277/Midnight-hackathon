# DEMO_SCRIPT — ~3 minutes

Two tracks, kept separate:

- **🎬 DO** — what you click and show. Glance at this.
- **🎤 SAY** — what you speak, word for word. Read this.

If you'd rather record voice in one pass, skip to **[Narration only](#narration-only--teleprompter)**
at the bottom: it is the whole script with no stage directions.

---

## Before you press record

1. **Windows PowerShell:** `docker start nightseal-proof-server` — check http://localhost:6300/ answers.
2. **WSL terminal:** `cd /root/nightseal && npm run serve` — wait for `operator service on http://127.0.0.1:8787`. **Do not record before this line appears** (the wallet re-syncs for ~10 minutes).
3. **Browser left:** http://localhost:8787 · **Browser right:** the contract on `preview.midnightexplorer.com`.
4. Both devices should read **COMPLIANT** at the same epoch. That is how the chain is parked right now.
5. Hide bookmarks, turn on Focus Assist, 1080p. **Never show the WSL terminal or `.env` on camera.**

**Timing — plan the edit around it.** Every action is a real ZK proof, so nothing is instant:

| Action | Roughly |
|---|---|
| Attest one device | 30–60 s |
| Revoke + replay stale proof | ~70 s |

Record continuously and cut the waits, or talk over them. The pauses are honest proof
generation, not lag.

**Reset between takes:** `curl -X POST http://localhost:8787/api/approve`, then attest both
devices back to green (~5 min). Epoch numbers climbing between takes is fine — only the drift matters.

---

## Beat 0 · 0:00–0:20 · The stake

### 🎬 DO
1. Show the dashboard, both cards green. Stay still — no clicking yet.

### 🎤 SAY
> "Your router's manufacturer must prove its firmware is clean — without publishing a map of its
> insides for attackers. Regulators increasingly demand proof of what's running on a device. But
> publishing that proof hands attackers a target map. NightSeal does both at once: it proves
> compliance, and reveals nothing."

---

## Beat 1 · 0:20–1:00 · It passes

### 🎬 DO
1. Click **Attest now** on *Sensor gateway · 02*.
2. Let it run — the button reads "Generating proof…".
3. When the card turns green, point at the **Device-bound proof** label.
4. Cut to the explorer, show the transaction.
5. Scroll the on-chain state slowly.

### 🎤 SAY
> "This device is proving three things in a single proof: that it holds the secret it was
> registered with, that its firmware is on the current approved list, and that every component
> built into that firmware is approved too. All of it stays private — the proof is generated
> here, on the device's side of the line."
>
> *(when green)*
>
> "The chain shows a yes. It never shows the firmware."
>
> *(over the explorer)*
>
> "A device id, a status, an epoch, two cryptographic roots. No hash. No version. No supplier."

---

## Beat 2 · 1:00–2:00 · The vulnerability

### 🎬 DO
1. Click **Revoke + replay stale proof** on *TLS Runtime 3.0*.
   **This exact button** — it does the revocation *and* beat 3 in one ~70-second action.
2. While it runs, point at, in this order:
   - the **epoch** number incrementing,
   - the **component capability root** — it changes,
   - the **firmware capability root** — **it does not change**. Hold on this.
3. Note every device dropping to amber.
4. Cut to the explorer, show the new transaction.

### 🎤 SAY
> "Now a vulnerability lands — not in the firmware itself, but in one component inside it. The
> operator removes that component."
>
> *(pointing at the roots)*
>
> "Watch these two values. The component root just changed. The firmware root did not — it is
> byte for byte identical. No firmware was touched, nothing was marked unsafe, and no list of
> affected products was published anywhere."
>
> *(over the explorer)*
>
> "And here is what the outside world sees: one update, carrying one opaque value. It could be
> an approval. It could be a revocation. It could be routine maintenance. There is no way to
> tell which — so an attacker cannot use this chain to learn that a vulnerability exists."

---

## Beat 3 · 2:00–2:20 · The chain refuses

### 🎬 DO
1. Wait for the log line: **"stale proof REJECTED by the Midnight ledger"**.
2. Point at the red card: **"Rejected by consensus, not by this dashboard."**

### 🎤 SAY
> "Something else just happened. Before revoking, we generated a valid attestation and held onto
> it. Then we submitted it — after the revocation. That proof was genuine. It was accepted
> moments earlier. The network re-checked it against the present state and threw the transaction
> out. That rejection is not our server's opinion. That is consensus."

---

## Beat 4 · 2:20–2:40 · One recovers, one cannot

### 🎬 DO
1. Click **Attest now** on *Sensor gateway · 02* → goes green at the new epoch.
2. Click **Attest now** on *Router · fleet-07* → stays red; the note changes.
3. Point at the changed note.

### 🎤 SAY
> "The clean device proves itself again immediately and goes green. The affected one cannot —
> and notice its firmware is still approved. Nothing looked it up on a vulnerability list. It
> simply can no longer build a valid proof, because one component inside it no longer exists in
> the approved set. The failure is arithmetic, not policy."

---

## Beat 5 · 2:40–3:00 · Close

### 🎬 DO
1. Flash `docs/architecture.svg` with the out-of-scope band visible.
2. Show the contract address / explorer page.
3. End on the dashboard.

### 🎤 SAY
> "Measuring the firmware in the first place is the hardware's job — secure boot and a TPM. What
> we built is the layer above it: the part that lets a manufacturer prove compliance today,
> lose that ability the moment a component becomes unsafe, and never publish a map of its
> insides to anyone."

---

## Narration only — teleprompter

Read straight through; the stage directions are gone. Roughly 420 words ≈ 3 minutes at a calm pace.

> Your router's manufacturer must prove its firmware is clean — without publishing a map of its
> insides for attackers. Regulators increasingly demand proof of what's running on a device. But
> publishing that proof hands attackers a target map. NightSeal does both at once: it proves
> compliance, and reveals nothing.
>
> This device is proving three things in a single proof: that it holds the secret it was
> registered with, that its firmware is on the current approved list, and that every component
> built into that firmware is approved too. All of it stays private — the proof is generated
> here, on the device's side of the line.
>
> The chain shows a yes. It never shows the firmware.
>
> A device id, a status, an epoch, two cryptographic roots. No hash. No version. No supplier.
>
> Now a vulnerability lands — not in the firmware itself, but in one component inside it. The
> operator removes that component.
>
> Watch these two values. The component root just changed. The firmware root did not — it is
> byte for byte identical. No firmware was touched, nothing was marked unsafe, and no list of
> affected products was published anywhere.
>
> And here is what the outside world sees: one update, carrying one opaque value. It could be an
> approval. It could be a revocation. It could be routine maintenance. There is no way to tell
> which — so an attacker cannot use this chain to learn that a vulnerability exists.
>
> Something else just happened. Before revoking, we generated a valid attestation and held onto
> it. Then we submitted it — after the revocation. That proof was genuine. It was accepted
> moments earlier. The network re-checked it against the present state and threw the transaction
> out. That rejection is not our server's opinion. That is consensus.
>
> The clean device proves itself again immediately and goes green. The affected one cannot — and
> notice its firmware is still approved. Nothing looked it up on a vulnerability list. It simply
> can no longer build a valid proof, because one component inside it no longer exists in the
> approved set. The failure is arithmetic, not policy.
>
> Measuring the firmware in the first place is the hardware's job — secure boot and a TPM. What
> we built is the layer above it: the part that lets a manufacturer prove compliance today, lose
> that ability the moment a component becomes unsafe, and never publish a map of its insides to
> anyone.

---

## Shot checklist

- [ ] Green COMPLIANT card, close up
- [ ] Explorer: attestation transaction
- [ ] **Firmware root unchanged + component root changed, in the same frame** (the flagship visual)
- [ ] Epoch incrementing / cards dropping to amber
- [ ] Explorer: the revocation transaction (looks like any other success)
- [ ] **Log line: "stale proof REJECTED by the Midnight ledger"**
- [ ] **Red card: "Rejected by consensus, not by this dashboard"**
- [ ] Green recovery on the clean device
- [ ] Red card again after re-attesting, now showing the *local* failure note
- [ ] Architecture diagram still
- [ ] Contract address on screen
