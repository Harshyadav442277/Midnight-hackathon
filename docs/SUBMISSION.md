# NightSeal — Devpost submission copy

This is paste-ready copy. Replace bracketed deployment fields only after the live Preview
lifecycle is captured.

## Project title

NightSeal

## Tagline

Firmware compliance as a revocable cryptographic capability.

## One-sentence pitch

NightSeal lets registered devices prove that their hidden firmware and every privately bound
component are currently approved, while a vulnerability can selectively remove that ability
without revealing which firmware contains the affected component.

## Inspiration and problem

Firmware vendors face a real conflict: auditors need current, independently verifiable
compliance evidence, but publishing exact versions and component inventories creates a target
map for attackers and exposes commercially sensitive supply-chain information. A normal allow
list solves the audit problem by sacrificing privacy. A normal zero-knowledge membership demo
protects privacy but says little about what happens when policy changes tomorrow.

NightSeal treats compliance as a capability that must survive the *current* policy roots. A
device is not labelled safe forever. It can prove compliance only while its private firmware,
its private dependency manifest, and its registered device identity all satisfy the latest
on-chain state.

## What it does

- Registers a cryptographic identity commitment for each device.
- Commits to firmware measurements and fixed-size private component manifests.
- Proves in zero knowledge that the prover knows the registered device secret, the hidden
  firmware is approved, and all three hidden components remain current.
- Publishes only the compliance result, device identifier, epoch, and two Merkle roots.
- Lets an operator revoke a component with an opaque root update. Firmware entries are left
  untouched, but every secretly dependent build loses the ability to construct a valid proof.
- Preserves the direct firmware PASS → REVOKE → FAIL lifecycle as a simpler fallback path.

## The memorable technical mechanism

The demo revokes TLS Runtime 3.0 from the component capability tree. **This was executed on
Preview and the firmware root came back byte-identical** while the component root moved. An
unaffected device re-attested successfully; the device whose hidden manifest contains TLS 3.0
could not obtain a current component path and therefore could not submit a compliant proof at
all. The blast radius emerges from cryptography, not from a backend CVE lookup or a public
firmware-to-component database.

There is a second, stronger failure mode. A proof built *before* the revocation — honest and
fully valid — was submitted afterwards anyway. The ledger re-checked the roots recorded in its
transcript against present state and **rejected the transaction itself**. Revocation is
enforced by consensus, not by application logic. Both outcomes are recorded with transaction
hashes in [docs/EVIDENCE.md](EVIDENCE.md).

Policy updates are also operation-hiding at the contract-call level: approval, revocation, and
cover rotation use the same leaf-update circuit and argument shape. Revocation writes a random
tombstone with no known opening. Root movement and transaction timing remain public, which is
documented as an explicit limitation.

## Why Midnight

NightSeal needs private witness execution and public, stateful policy in the same application.
The private side holds device secrets, firmware measurements, commitment openings, component
composition, and Merkle paths. The public ledger holds the current capability roots, operator
authorization, registered identity commitments, epochs, and minimal audit results. A regular
database could hide the inventory, but auditors would have to trust its operator. A public
smart contract could make policy auditable, but would expose the inventory. Midnight lets the
proof connect those two requirements without publishing the witness.

## How it was built

- Compact contract with two current-only Merkle capability trees and a device-identity map.
- Midnight.js providers, Preview wallet integration, and a local proof server.
- TypeScript operator/device simulator and auditor API.
- React dashboard showing both roots, epoch drift, device binding, and the selective
  component-revocation lifecycle.
- Eleven lifecycle and adversarial tests covering identity impersonation, component
  substitution, stale-root replay, rogue operators, secrecy serialization, and both revocation
  paths.

## Challenges and decisions

The key design challenge was keeping the component relationship private while ensuring an
approved firmware proof could not swap in a clean component list. NightSeal solves this by
binding a digest of exactly three component commitments into the firmware capability
commitment, then checking every component against the current component root in the same
attestation circuit.

We intentionally did not add tokens, NFTs, AI, extra chains, or a public SBOM. None of them
improves the security or privacy property. We also rejected fleet-threshold proofs for this
version because the public per-device status map would make the claimed fleet privacy mostly
decorative.

## Limitations

The demo derives deterministic measurements and simulates the hardware root of trust. A
production device would obtain the measurement and signing authority from measured boot and a
TPM or secure element. Manifests currently contain exactly three components and each tree has
1,024 leaves. Operation type is hidden by the update shape, but timing and root changes are
public. The operator service is a loopback-only hackathon component, not production key
infrastructure.

## Links

- Source: https://github.com/Harshyadav442277/Midnight-hackathon
- Live auditor dashboard (read-only): https://nightseal.vercel.app
- Preview contract: https://preview.midnightexplorer.com/contract/160c6bfcd360c8806bea5d45740f45d80930482038f57e55b72f6d002bb0ef6e
- Component-revocation (root-update) transaction: https://preview.midnightexplorer.com/tx/98d6a6ab5836e5212d663368cb571e99838fd139fbe65ae09915b9e64c0c1507
- Attestation transaction: https://preview.midnightexplorer.com/tx/73dea0b0f198c8033eb7e90f796b871819574bc2adc4a36869b264dcf95ab0e7
- Post-revocation recovery of the unaffected device: https://preview.midnightexplorer.com/tx/040fd591c82b0a0029893c4cd55650d85a20e2a451850a29b07340466560353d
- Full lifecycle evidence: [docs/EVIDENCE.md](EVIDENCE.md)
- Demo video: `[PENDING RECORDING]`

## Final submission checklist

- [x] Preview contract link resolves publicly.
- [x] Root-update transaction link resolves publicly.
- [ ] Video shows firmware root unchanged while component root changes.
- [ ] Video shows clean recovery and secretly dependent failure.
- [ ] README contains contract, transaction, and video links.
- [ ] Public repository contains no `.env`, wallet seed, or private openings.
