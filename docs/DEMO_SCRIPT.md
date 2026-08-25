# DEMO_SCRIPT — ~3 minutes, three beats

The build is always aimed at making this script demoable. Record footage incrementally the moment each piece works; assemble at the end. No unexplained acronym before 1:00.

## 0:00–0:20 — The stake
On camera/voiceover, over title card:
> "Your router's manufacturer must prove its firmware is clean — without publishing a map of its insides for attackers."

Then: regulators demand proof of firmware provenance; vendors can't afford disclosure; zero-knowledge is the only technology that satisfies both. (Screen: name + one-line tagline.)

## 0:20–1:00 — Beat 1: PASS
- Attest panel: device `router-fleet-07` runs attestation. Proof generated locally (flash the proof-server log), tx submitted.
- Auditor dashboard: `router-fleet-07` flips to big green **COMPLIANT**.
- Side-by-side: public explorer shows the attestation tx — and *nothing sensitive*.
- Say out loud: **"The chain shows a yes — never the firmware."**

## 1:00–2:00 — Beat 2: CVE → revocation → FAIL (the money shot)
- "A vulnerability just dropped in one approved firmware build." (Now the words CVE/SBOM are allowed.)
- Operator publishes the updated approved root. Show the root-update transaction ON the explorer.
- Affected device re-attests → **fails**. Dashboard: green flips to red **NON-COMPLIANT**, with timestamp/epoch. Film dashboard + explorer side-by-side throughout.

## 2:00–2:30 — Beat 3: replay rejected
- Device replays its OLD proof against the new root → rejected on-chain. Show the rejection.
- "Pass. Fail. And no cheating with yesterday's proof."

## 2:30–3:00 — Boundary + close
- One sentence: "The hardware root of trust is the platform's job — our contribution is the privacy-preserving transparency layer above it." (Architecture diagram flash, boundary labeled.)
- Deployed contract address on screen. Close on the stake line.

## Shot checklist (capture as soon as each exists)
- [ ] Proof server log during proof generation
- [ ] Explorer: attestation tx (no sensitive data visible — zoom on it)
- [ ] Explorer: root-update tx
- [ ] Dashboard green→red flip (multiple takes)
- [ ] Failed replay error
- [ ] Architecture diagram still
