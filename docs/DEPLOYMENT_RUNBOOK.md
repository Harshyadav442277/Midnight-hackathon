# NightSeal Preview deployment runbook

Use this immediately after the faucet funds the operator address. Run every command from
`/root/nightseal` in WSL Ubuntu. Keep the terminal output: it is submission evidence.

## 1. Preflight

```bash
docker start nightseal-proof-server
curl http://localhost:6300/
npm run cli -- balance
```

If `NIGHT > 0` and `DUST = 0`, register the faucet output and wait for DUST:

```bash
npm run cli -- dust
npm run cli -- balance
```

Do not deploy until the final command reports `DUST > 0`.

## 2. Deploy and bootstrap

```bash
npm run cli -- deploy 2>&1 | tee docs/deploy-preview.log
```

The command deploys the contract, registers the three device identities, publishes four
component capabilities, publishes two firmware capabilities, persists the address locally,
and prints the explorer URL. Copy the contract address and every transaction hash into
`docs/EVIDENCE.md`.

## 3. Capture the cryptographic lifecycle

Start the service in terminal A while recording the dashboard and explorer:

```bash
npm run serve
```

Run these in order from terminal B:

```bash
npm run cli -- attest sensor-gateway-02
npm run cli -- revoke-component tls-3.0-cve
npm run cli -- attest sensor-gateway-02
npm run cli -- attest router-fleet-07
```

The last command must fail locally before submission because the bound TLS 3.0 component no
longer has a current Merkle path. That failure deliberately has no transaction hash. Capture
the exact error and the red dashboard state as evidence that the prover could not manufacture
a compliant proof.

Record these invariants before and after component revocation:

- The firmware root is byte-for-byte unchanged.
- The component root changes.
- The baseline epoch increments.
- The clean device can submit a fresh attestation.
- The secretly dependent device cannot submit one.

## 4. Final evidence gate

- Open the contract and the three successful lifecycle transactions in the Preview explorer.
- Save a contract screenshot and the root-update screenshot in `docs/`.
- Replace every `pending` field in `docs/EVIDENCE.md`.
- Add the contract and video URLs to `README.md` and `docs/SUBMISSION.md`.
- Run `npm run typecheck && npm test && npm run build` once more.
- Commit and push before completing the Devpost form.
