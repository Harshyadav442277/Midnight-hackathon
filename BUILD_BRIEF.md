# BUILD BRIEF — "NightSeal" — Confidential Firmware Attestation on Midnight

You (Claude Code) are the sole builder. This document is the complete handoff: the idea has already been vetted by a three-agent panel (adversarial critic, idea scout, rubric judge) against the live Devpost page, current Midnight docs, and past Midnight hackathon winners. **The idea, design, and scope below are decided — do not relitigate them.** Your job is execution. The verdict was: strongest idea available (ranked #1 of 6, weighted 76.25% on the official rubric), ~30–40% first-place chance IF the playbook below is followed with discipline.

## 1. Non-negotiable facts (verified 2026-08-25 from the Devpost page)

- **Event:** Brainwave 2026 — Midnight Blockchain Track. https://brainwave-2026-midnight-track.devpost.com/
- **DEADLINE: August 27, 2026, 7:00 AM IST.** Compute remaining hours from the current time the moment you start. There is no slack; every phase below is time-boxed.
- **Eligibility: STUDENTS ONLY.** The user must confirm they qualify. If not confirmed, stop and ask.
- **Judging reality:** ONE judge (generalist, no stated security background), virtual event, no live Q&A. Judges see ONLY: the repo (README first), the deployed contract on a public explorer, and a ~3-minute demo video. The effective question is "did I get it in 60 seconds" — every artifact must be legible to someone with zero security-domain knowledge.
- **Hard requirements (miss any = disqualified):** full-stack app on the Midnight ecosystem; Midnight used meaningfully (not decoratively); smart contract deployed on Midnight **Preview or PreProd**; working demonstration; clear documentation and setup instructions.
- **Rubric:** Innovation & Creativity 25%, Technical Implementation 25%, Impact & Problem Solving 20%, UX & Design 15%, Scalability & Feasibility 10%, Presentation & Demo 5%.
- Small community event: $220 total pool, likely small field. A *finished* submission (deployed + working demo + clean README) very likely makes top-3 by default; first place is won on polish + instant legibility.

## 2. The product (one paragraph)

**NightSeal** (working name — a better two-word, sponsor-aware name is allowed, but do not spend more than 5 minutes on it): a privacy-preserving firmware attestation registry. A device manufacturer proves in zero knowledge that a device's firmware hash is a member of the current *approved baseline* (a Merkle set) — without revealing the hash, firmware version, SBOM, or suppliers. The public chain shows only a yes/no compliance status per device and the current approved-set Merkle root. When a CVE drops, the registry operator publishes an updated root (revocation); devices on the revoked firmware visibly fail re-attestation — while the public explorer never shows a single sensitive byte.

**One-sentence human stake (open every artifact with this, before any acronym):**
> "Your router's manufacturer must prove its firmware is clean — without publishing a map of its insides for attackers."

**Public / Private / Provable table (goes in README):**

| | |
|---|---|
| **Public on-chain** | device ID → compliance status (enum), current approved-set Merkle root, root-update history |
| **Private, never on-chain** | firmware hashes, SBOM/HBOM, versions, supplier list |
| **Provable** | "this device's firmware hash is a member of the current approved set" |

**Impact anchors (cite in README/video):** CERT-In directions, NIST SP 800-193, IEC 62443, EN 303 645 — regulators demand provenance proof; disclosure leaks competitive data and hands attackers a target map; ZK satisfies both sides. Privacy is structurally necessary here, not decorative.

## 3. Locked design decisions (with rationale — record these in ARCHITECTURE.md, do not reopen)

1. **Membership proof against a revocable approved set, via Compact's stdlib Merkle primitives.** `MerkleTree` / `HistoricMerkleTree` ledger ADTs and `merkleTreePathRoot` exist in the Compact standard library (verified against current docs). No custom cryptography.
2. **Revocation = republish an updated approved root. NEVER attempt ZK non-membership proofs.** Root republication is the textbook-correct design, not a compromise. This was confirmed by all three review agents.
3. **Root of trust is mocked, and disclosed loudly exactly once.** The "device" is a script/simulator that supplies its firmware hash. Real systems use measured boot + TPM — that layer is out of scope by standard, citable assumption (NIST SP 800-193, TCG remote attestation). One architecture diagram in the README shows this boundary labeled "out of scope — platform responsibility," plus one spoken sentence in the video: "the hardware root of trust is the platform's job; our contribution is the privacy-preserving transparency layer above it." Disclosed = competence; discovered = fakery.
4. **Pre-empt the ZK Loan comparison.** Midnight's official ZK Loan tutorial shares this skeleton (attestation checked in ZK → on-chain yes/no). The README gets a section titled **"Beyond the tutorials"**: one-shot attestation (ZK Loan) vs. NightSeal's *stateful revocable baseline with an on-chain lifecycle* (attest → CVE → root update → fail re-attestation) — and links the actual root-update transaction on the explorer as proof it is implemented, not described. This defends the 25% Innovation score.
5. **Verify everything against live docs before writing code.** https://docs.midnight.network/ — Compact syntax and tooling change frequently; do not rely on training memory. Study the official example DApps (counter, bulletin board) for current project structure, compiler invocation, and Midnight.js wiring.

## 4. Scope contract — brutal and exact

**IN (this is the whole build):**
- **ONE circuit:** prove `deviceFirmwareHash ∈ currentApprovedRoot` (Merkle membership; hash is a private witness).
- **ONE admin function:** publish an updated approved root (= revocation event).
- **Attestation entrypoint:** device submits proof → public compliance status for its device ID flips to compliant (and a re-attestation after revocation fails).
- **TWO screens max** in one web app: (1) auditor dashboard — device list with big, visceral compliance state (green PASS → red FAIL flip with color/motion/timestamp); (2) manufacturer/attest panel (can be a tab or modal on the same page). The third "screen" of the demo is the public block explorer itself — not built, just shown.
- Deployed to **Preview or PreProd**, address + explorer link at the top of the README.

**OUT (do not build, even if time appears to allow):** SBOM parsing, multiple component types, supplier hierarchies, historic-root queries, multi-tenant anything, auth/login, settings pages, mobile, token economics. Ambition belongs in the product story, not the circuit.

## 5. Build order (time-boxed; sequence is mandatory)

**Phase 0 — kill the disqualification gate (first ~4 hours).**
Set up toolchain (Compact compiler, Midnight.js, proof server via Docker, Lace wallet on the test network, faucet tDUST) following current docs exactly. Deploy a minimal stub contract (even a counter) to Preview/PreProd. Screenshot the explorer entry. From this moment the hard gate is dead and everything else is iteration. *There is no local-devnet fallback for the submission — this step cannot be deferred.*

**Phase 1 — the real contract (next ~8–10 hours).**
Write the NightSeal Compact contract: Merkle approved set, membership circuit, admin root update, device compliance status map. Compile → typecheck → test locally → deploy. Verify the full lifecycle on-chain: attest passes → root update → re-attest fails. Commit at every working increment.

**Phase 2 — the app (next ~8–10 hours).**
Two screens, wired through Midnight.js + proof server + Lace. All UI polish hours go to ONE thing: the green→red revocation flip on the auditor dashboard. Enterprise-clean, minimal, no decoration elsewhere.

**Phase 3 — demo video + README (final ~6–8 hours, but START RECORDING EARLIER).**
Record footage incrementally the moment each piece works — never bet the submission on one final recording session against faucet/indexer/proof-server stalls. Assemble the ~3-minute video per the script below. Write the README per the spec below. **Submit on Devpost well before 7:00 AM IST Aug 27** (form, video link, public repo link).

**CONTINGENCY (hard trigger):** if no contract is deployed to Preview/PreProd by **Aug 26, 7:00 AM IST (T-24h)**, cut the frontend to a single screen and submit thin-but-deployed. A finished narrow submission beats an unfinished ambitious one on every rubric axis.

## 6. Demo video script (~3 minutes, three beats)

1. **0:00–0:20 — the stake.** Speak the one-sentence human stake. Then: regulators demand proof, vendors can't afford disclosure, ZK is the only technology that satisfies both.
2. **0:20–1:00 — Beat 1: PASS.** A compliant device attests; dashboard shows green. Side-by-side, the public explorer shows the transaction — and *nothing sensitive*. Say it out loud: "the chain shows a yes — never the firmware."
3. **1:00–2:00 — Beat 2: CVE → revocation → FAIL.** "A vulnerability just dropped." Operator publishes the updated root — show the root-update transaction ON the explorer. The affected device re-attests and visibly fails: green flips to red. This is the money shot; film dashboard and explorer side-by-side throughout.
4. **2:00–2:30 — Beat 3: replay rejected.** The device replays its old proof against the new root — rejected on-chain. Three beats: pass / fail / replay-rejected.
5. **2:30–3:00 — the boundary + close.** One sentence on the mocked root of trust ("the hardware root of trust is the platform's job…"), the architecture diagram flash, deployed address on screen, close on the stake.

No unexplained acronym before 1:00. Introduce "SBOM"/"CVE" only after the stake lands.

## 7. README spec (the README *is* the pitch — judges read it first)

Order: memorable name + one-sentence stake → deployed contract address + explorer link → public/private/provable table → 3-beat demo GIF or video link → architecture diagram (with the root-of-trust boundary labeled out-of-scope, NIST SP 800-193 cited) → **"Beyond the tutorials"** section (vs. ZK Loan — stateful revocable lifecycle, link the real root-update tx) → "Why this needs Midnight specifically" (30 seconds of reading, dual-ledger model) → setup in ≤5 commands → assumptions & limitations (honest, citable).

## 8. Known traps (each has burned first-time Midnight builders for hours)

- Proof server Docker version must match the Compact compiler version — check the docs' compatibility matrix.
- tDUST faucet can be slow or down — request tokens in Phase 0, not when you need them.
- Lace wallet needs explicit test-network configuration; indexer sync can lag behind deployment.
- Compact circuits are static — no unbounded loops/recursion; keep ledger state small and boring.
- Windows host: run the toolchain via Docker/WSL if native tooling misbehaves; don't burn hours fighting the host OS.

## 9. Working style

- Feedback loop per change: compile → typecheck → test → run → git commit. One task per change.
- Maintain lightweight docs as you go: ARCHITECTURE.md (decisions + rejected alternatives), TASKS.md (time-boxed checklist from §5), GAPS.md (honest limitations — feeds the README's assumptions section).
- Prefer the simplest sound design over the most impressive-sounding one. The rubric is won in the video and README, not in circuit cleverness.
