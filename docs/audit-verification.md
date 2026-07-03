# Audit Verification

`npm run audit:verify` reconstructs VCEM consent/access evidence from chain data only:

- Besu or local RPC endpoint;
- deployed VCEM contract addresses;
- local ABI artifacts;
- on-chain logs;
- deployed bytecode fetched from RPC.

The verifier reconstructs consent versions, actor-set roots, consent hashes, previous-hash continuity, data-hash registrations, latest consent at the access block, and authorized access events. It reports JSON and CSV files under `evidence/audit/` and exits non-zero on validation failure.

Example:

```bash
npm run audit:verify -- --mode full --rpc=http://127.0.0.1:8545 --consent=<VCEMConsent> --audit=<VCEMAudit>
npm run audit:verify -- --mode sample --sample-size 100 --seed 42 --rpc=http://127.0.0.1:8545 --consent=<VCEMConsent> --audit=<VCEMAudit>
```

Current limitation: signature-expiry validation from historical calldata is not yet implemented; the verifier validates the resulting event, consent chain, actor set, latest consent version, purpose/scope policy, request uniqueness, and data-hash binding.
