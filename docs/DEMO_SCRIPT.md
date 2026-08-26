# DEMO_SCRIPT — ~3 minutes

Two tracks, kept separate:

- **🎬 DO** — what you click and show. Glance at this.
- **🎤 SAY** — what you speak, word for word. Read this.

If you'd rather record voice in one pass, skip to **[Narration only](#narration-only--teleprompter)**
at the bottom: it is the whole script with no stage directions.

---

## Before you press record

1. **Windows PowerShell:** `docker start nightseal-proof-server` — check http://localhost:6300/ answers.
2. **Operator service.** First check whether one is already running — open http://localhost:8787.
   If the dashboard loads, **skip this step**; starting a second one fails with a port conflict.
   Otherwise, in a **WSL terminal:** `cd /root/nightseal && npm run serve` and wait for
   `operator service on http://127.0.0.1:8787`. **Do not record before that line appears** — the
   wallet re-syncs for ~10 minutes on every start.
3. **One browser window with two tabs — not two windows side by side.** Side-by-side halves the
   width, and the Merkle roots are long numbers that have to stay readable.
   - **Tab 1:** http://localhost:8787 — the dashboard, where most of the video lives.
   - **Tab 2:** the contract on `preview.midnightexplorer.com` — open it *before* you record.

   Switch with **Ctrl+Tab**. Nothing needs both on screen at once: the flagship shot — firmware
   root unchanged beside the changed component root — is entirely on the dashboard. While
   recording, don't click the explorer links in the dashboard's log; they spawn extra tabs.
   Switch to tab 2 and press **F5** instead.
4. **Check the starting state — this is the one thing that ruins a take.** Every device must read
   **RE-ATTESTATION REQUIRED** (amber), *not* COMPLIANT. See below.
5. Hide bookmarks, turn on Focus Assist, 1080p. **Never show the WSL terminal or `.env` on camera.**

### ⚠️ Start amber, not green

A card only visibly changes if it is **not already green at the current epoch**. If every device
is already COMPLIANT, clicking **Attest now** re-proves the same thing at the same epoch and
*nothing moves on screen* — there is no flip to film.

So before recording, move the baseline **without** attesting:

```bash
curl -X POST http://localhost:8787/api/approve
```

That republishes the policy (epoch jumps by 6) and leaves every device amber —
"the baseline moved, this device has not proved itself against the new one." **Do not attest
afterwards.** Now Beat 1's click produces a real amber → green flip, and every later beat has a
visible transition too.

Takes about four minutes. Verify before recording:

```bash
curl -s http://localhost:8787/api/state
```

Every device should show `RE-ATTESTATION REQUIRED`.

*(On Windows PowerShell write `curl.exe` rather than `curl`.)*

**About the third card.** The demo uses *Sensor gateway · 02* (clean) and *Router · fleet-07*
(secretly depends on the vulnerable component). *Edge camera · 11* just sits amber throughout —
it is a device that has not checked in. Leave it alone; don't draw attention to it.

**Timing — plan the edit around it.** Every action is a real ZK proof, so nothing is instant:

| Action | Roughly |
|---|---|
| Attest one device | 30–60 s |
| Revoke + replay stale proof | ~70 s |

Record continuously and cut the waits, or talk over them. The pauses are honest proof
generation, not lag.

**Reset between takes:** `curl -X POST http://localhost:8787/api/approve` — and stop there. That
single command restores the revoked component *and* returns every device to amber, which is
exactly the starting state you want. Do **not** attest afterwards, or you will be back to the
un-filmable all-green state. Epoch numbers climbing between takes is fine; only the drift matters.

---

## Beat 0 · 0:00–0:20 · The stake

### 🎬 DO
1. Show the dashboard with every card **amber**. Stay still — no clicking yet.

### 🎤 SAY
> "Your router's manufacturer must prove its firmware is clean — without publishing a map of its
> insides for attackers. Regulators increasingly demand proof of what's running on a device. But
> publishing that proof hands attackers a target map. NightSeal does both at once: it proves
> compliance, and reveals nothing."

---

## Beat 1 · 0:20–1:00 · It passes

### 🎬 DO
1. Click **Attest now** on *Sensor gateway · 02*. Wait 30–60 s → flips **amber → green**.
2. Click **Attest now** on *Router · fleet-07*. Wait again → also flips **amber → green**.
   **Attest both.** The viewer must see Router pass, or beat 3 makes no sense.
3. Point at the **Device-bound proof** label on a green card.
4. Ctrl+Tab to the explorer, press **F5**, show one of the transactions, then Ctrl+Tab back.
5. Scroll the on-chain state slowly.

### 🎤 SAY
> "Each of these devices is proving three things in a single proof: that it holds the secret it
> was registered with, that its firmware is on the current approved list, and that every
> component built into that firmware is approved too. All of it stays private — the proof is
> generated here, on the device's side of the line."
>
> *(once both are green)*
>
> "Both devices are compliant. The chain shows a yes. It never shows the firmware."
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
4. Ctrl+Tab to the explorer, press **F5**, and point at the **Entry Point** field: it reads
   `updateComponentLeaf` — the very same name the *approval* transactions carry.

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
> "And here is what the outside world sees. The entry point reads 'update component leaf' —
> which is exactly what it read when these components were approved in the first place. Same
> circuit, same shape, one opaque value. It could be an approval. It could be a revocation. It
> could be routine maintenance. There is no way to tell which — so an attacker cannot watch this
> chain to learn that a vulnerability exists."

---

## Beat 3 · 2:00–2:20 · The chain refuses

### 🎬 DO
1. Wait for the log line: **"stale proof REJECTED by the Midnight ledger"**.
2. Point at the red card: **"Rejected by consensus, not by this dashboard."**

### 🎤 SAY
> "Something else just happened. Before revoking, we generated a fresh attestation for that
> router and held onto it. Then we submitted it — after the revocation. That proof was genuine;
> it is the same device you watched pass a minute ago. The network re-checked it against the
> present state and threw the transaction out. That rejection is not our server's opinion. That
> is consensus."

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
> Each of these devices is proving three things in a single proof: that it holds the secret it
> was registered with, that its firmware is on the current approved list, and that every
> component built into that firmware is approved too. All of it stays private — the proof is
> generated here, on the device's side of the line.
>
> Both devices are compliant. The chain shows a yes. It never shows the firmware.
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
> And here is what the outside world sees. The entry point reads 'update component leaf' — which
> is exactly what it read when these components were approved in the first place. Same circuit,
> same shape, one opaque value. It could be an approval. It could be a revocation. It could be
> routine maintenance. There is no way to tell which — so an attacker cannot watch this chain to
> learn that a vulnerability exists.
>
> Something else just happened. Before revoking, we generated a fresh attestation for that router
> and held onto it. Then we submitted it — after the revocation. That proof was genuine; it is
> the same device you watched pass a minute ago. The network re-checked it against the present
> state and threw the transaction out. That rejection is not our server's opinion. That is
> consensus.
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
