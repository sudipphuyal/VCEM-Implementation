# Audit Verification

`npm run audit:verify` reconstructs VCEM consent/access evidence from chain data only:

- Besu or local RPC endpoint;
- deployed VCEM contract addresses;
- local ABI artifacts;
- on-chain logs;
- transaction calldata;
- transaction receipts and block metadata;
- deployed bytecode fetched from RPC for the separate bytecode verifier.

The verifier sorts consent, registry, data-hash, denied-access, and authorized-access events by `blockNumber`, `transactionIndex`, and `logIndex`. It reconstructs consent versions, actor-set roots, consent hashes, previous-hash continuity, immutable lifecycle history, data-hash registrations, historical registry identity/role state, latest active consent at the exact access event position, and authorized access events.

For each `AccessAuthorized` event it decodes `authorizeAndLogAccess` calldata, reconstructs the EIP-712 `VCEMAudit` domain and `AccessRequest` message, recovers the signer, checks the historical requestor wallet, verifies the request expiry against the block timestamp, validates the expected consent hash, checks actor/purpose/scope/data-hash binding, and detects replayed request IDs.

`AccessDenied` events are checked where the emitted evidence permits: non-empty request ID, explicit reason code, and gateway-signed denial transaction. Denied events do not imply data release.

Reports are written as JSON and CSV under `evidence/audit/` and the command exits non-zero on validation failure.

Example:

```bash
npm run audit:verify -- --mode full --rpc=http://127.0.0.1:8545 --registry=<VCEMRegistry> --consent=<VCEMConsent> --audit=<VCEMAudit>
npm run audit:verify -- --mode sample --sample-size 100 --seed 42 --rpc=http://127.0.0.1:8545 --registry=<VCEMRegistry> --consent=<VCEMConsent> --audit=<VCEMAudit>
npm run audit:verify-bytecode -- --rpc=http://127.0.0.1:8545 --manifest=deployments/vcem-manifest.json
```

Sample mode uses deterministic seeded selection. With `--sample-size 100 --seed 42`, it selects exactly 100 access events when at least 100 eligible events exist, stratifying across initial-active, modified-active, and revoked consent histories where possible. If fewer than 100 eligible access events exist, the JSON report includes a notice and verifies all eligible events.

Current limitations: the verifier can only verify events and transactions available from the RPC endpoint; it cannot prove application-level non-release for denied events; and historical identity checks are limited to lifecycle events emitted by `VCEMRegistry`.
