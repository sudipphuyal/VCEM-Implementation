# Final VCEM Alignment Report

## Existing Components Retained

- Legacy DSA/RSA/resource-certification contracts remain for backward compatibility and prototype provenance.
- Legacy Groth16/ZKP contracts and Circom files remain isolated as experimental assets.
- VCEM registry, consent, audit, audit verifier, FHIR mapper, pseudonymization, Besu scaffold, and benchmark scaffold are retained and extended.

## Components Corrected or Enhanced

- `VCEMConsent` no longer mutates historical consent records. Prior active versions remain immutable; updates append a new `ACTIVE` version and revocation appends a `REVOKED` version.
- `VCEMAudit` continues to atomically validate active consent, actor, purpose, scope, data hash, expiry, signature, and replay status.
- `scripts/auditVerify.ts` now checks that an access event references the latest active consent version at the access block.
- `scripts/verifyDeployedBytecode.ts` compares on-chain runtime bytecode to locally compiled deployed bytecode rather than comparing against a circular manifest hash.
- `services/data-proxy/secureProxy.ts` adds authenticated, one-time release enforcement around `AccessAuthorized` receipts.
- `services/fhir-adapter/vcemMapper.ts` maps anonymized Consent fixtures to VCEM lifecycle call payloads and authorized access records to AuditEvent-shaped output.
- Hardhat is configured to use local `solc@0.8.20` for VCEM compiler builds.

## New Components Added

- `services/auth/walletAuth.ts`
- `services/storage/artifactStore.ts`
- `services/encryption/keyProvider.ts`
- `services/data-proxy/secureProxy.ts`
- `services/fhir-adapter/vcemMapper.ts`
- `fixtures/fhir/*.json`
- `test/DataProxy.ts`
- `test/FHIRAdapter.ts`
- `docs/final-alignment-baseline.md`
- `docs/final-alignment-plan.md`

## Consent Immutability Fix

The previous design changed prior version status to `SUPERSEDED`, which invalidated recomputation because status is part of the canonical consent hash. The corrected design uses immutable version records:

- create: appends version 1 with `ACTIVE`;
- update: appends a later `ACTIVE` version;
- revoke: appends a later `REVOKED` version;
- supersession is derived from a later version existing, not stored by mutating history.

Tests recompute historical hashes after create, multiple updates, and revocation.

## Data Proxy Security Design

The secure proxy layer requires an authenticated session whose requestor ID matches the authorized event. It validates chain ID, audit contract address, receipt status, event topic, participant ID, requestor ID, data hash, scope hash, purpose, request ID, consent version, consent hash, confirmation count, and one-time delivery ledger state before decrypting.

Plaintext data is returned only after receipt verification and is not stored in the delivery ledger. Cryptographic erasure is represented by deleting the participant key.

## Audit Verifier Coverage

The audit verifier reconstructs consent versions, recomputes consent hashes, validates previous-hash continuity, recomputes actor roots, validates immutable version-specific actor membership, replays registry lifecycle events for historical wallet/role state, checks latest active consent at the exact access event position, decodes `authorizeAndLogAccess` calldata, recovers the EIP-712 signer, validates purpose/scope/data-hash binding, request expiry, expected consent hash, and detects replayed request IDs in observed events.

Remaining verifier limitations:

- denied access verification is limited to emitted denial evidence and gateway-signed denial transactions;
- historical wallet-to-requestor mapping at block height is limited by current `VCEMRegistry` event coverage;
- live Besu audit reports require deployed addresses and RPC access.

## FHIR Mapping Coverage

FHIR mapping remains fixture-level. Active, modified, and revoked anonymized Consent fixtures map into VCEM lifecycle call payloads; unsupported nested provision semantics are rejected; authorized access data maps into an AuditEvent-shaped object. The repository does not implement live FHIR-server integration.

## Besu Deployment Validation

The Besu topology remains scaffolded. A real generated IBFT `extraData`, validator-key set, static peers, block-production proof, and deployment manifest have not been produced in this environment.

## VCEM Matrix Results

- `npm run test:vcem:matrix`: passes.
- The authoritative matrix records exactly 60 deterministic policy cases and 120 outcomes.
- Evidence files are generated under `artifacts/vcem-matrix/`.

## Benchmark Tooling and Evidence

Benchmark scaffolding exists, but no end-to-end benchmark runs were executed. No performance numbers are claimed.

## Security Findings and Fixes

Fixes:

- `.env` is ignored and removed from tracking.
- Generated proof/local inputs are untracked.
- Actor roots are contract-derived.
- Historical consent records are immutable.
- Data proxy has one-time release protection.
- Local `solc@0.8.20` is pinned for VCEM compile reproducibility.

Open findings:

- `npm audit --audit-level=low` reports 59 vulnerabilities.
- Slither is configured but not installed locally.
- Legacy ZKP tests remain failing and isolated.

## Supported Paper Claim

Supported by current code and tests:

> Independently verifiable per-access consent-state binding.

## Claims Requiring More Work or Manuscript Revision

- Legal GDPR compliance.
- Production clinical deployment.
- Live FHIR-server integration.
- Complete ZKP-based privacy-preserving authorization proof.
- Executed Besu five-node experiment.
- Executed benchmark results and baseline comparison.
