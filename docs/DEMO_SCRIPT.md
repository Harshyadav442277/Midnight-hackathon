# DEMO SCRIPT — 3 minutes, 3 clicks

Longer version with every caveat: [DEMO_SCRIPT_long.md](DEMO_SCRIPT_long.md).

## Before you record

- All three cards must be **amber**. If not: `curl.exe -X POST http://localhost:8787/api/approve`
  (~4 min), then refresh. **Don't attest afterwards.**
- Load the page once. **Don't refresh during a take** — it clears the transaction log.
- Two tabs, one window: dashboard + the explorer contract page. Ctrl+Tab to switch.
- Each click takes 45–70 seconds of real proving. Talk over the wait, cut it in the edit.

---

## 0:00 · The stake — no clicking

> "Your router's manufacturer must prove its firmware is clean — without publishing a map of its
> insides for attackers. Regulators demand that proof. Publishing it hands attackers a target
> map. NightSeal does both at once: it proves compliance, and reveals nothing."

---

## 0:20 · Click 1 — **Attest now** on *Router · fleet-07*

Card goes amber → **green**.

> "This device is proving three things in one proof: that it holds the secret it was registered
> with, that its firmware is on the current approved list, and that every component inside that
> firmware is approved too. All of it stays private."
>
> *(when green)*
>
> "Compliant. The chain shows a yes — it never shows the firmware. A device id, a status, an
> epoch, two cryptographic roots. No hash. No version. No supplier."

---

## 1:00 · Click 2 — **Revoke + replay stale proof** on *TLS Runtime 3.0*

Not the plain Revoke button. Takes ~70 s and does everything.

> "Now a vulnerability lands — not in the firmware, but in one component inside it. The operator
> removes that component."
>
> *(point at the two roots)*
>
> "Watch these. The component root just changed. The firmware root did not — byte for byte
> identical. No firmware was touched. Nothing was marked unsafe. No list of affected products was
> published anywhere."
>
> *(when the card turns red)*
>
> "That device just lost the ability to prove. And we did one more thing: we took a proof it
> generated seconds earlier — before the revocation — and submitted it anyway. The network
> refused the transaction. That is not our server saying no. That is consensus."

Scroll to **Recent transactions** and hold on *"stale proof REJECTED by the Midnight ledger"*.

---

## 2:10 · Click 3 — **Attest now** on *Sensor gateway · 02*

Goes **green**.

> "A different device, which does not contain that component, proves itself immediately. Nothing
> consulted a vulnerability list. One device is blocked, one passes, and the difference is pure
> cryptography — computed against a dependency graph the chain never sees."

---

## 2:40 · Close

> "Measuring the firmware is the hardware's job. What we built is the layer above it: prove
> compliance today, lose that ability the moment a component becomes unsafe, and never publish a
> map of your insides to anyone."

Flash the architecture diagram and the contract address, then end.

---

## Must-have shots

- [ ] Amber → green on the first attestation
- [ ] **Firmware root unchanged beside the changed component root** — same frame
- [ ] Red card: *"Rejected by consensus, not by this dashboard"*
- [ ] Log line: *"stale proof REJECTED by the Midnight ledger"*
- [ ] Second device going green afterwards
