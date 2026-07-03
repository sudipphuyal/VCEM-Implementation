# Claim to Evidence

| Claim | Source module | Contract/service | Tests/evidence | Limitation |
| --- | --- | --- | --- | --- |
| Sensitive data remain off-chain. | `contracts/vcem/*` | VCEM contracts use hashes/IDs only. | `test/VCEM.ts` | Legacy contracts still store plaintext prototype strings. |
| Consent is versioned and revocable. | `VCEMConsent.sol` | `createConsent`, `updateConsent`, `revokeConsent`. | `test/VCEM.ts` | Participant wallet custody is assumed. |
| Actor set is cryptographically bound to consent. | `VCEMConsent.sol`, `CanonicalHash.sol` | Contract-sorted actor list and derived `actorsRoot`. | `test/VCEM.ts` | Bounded to 64 actor IDs per consent version. |
| Per-access consent-state binding. | `VCEMAudit.sol` | `authorizeAndLogAccess`. | `test/VCEM.ts`, `test/VCEMMatrix.ts`, `artifacts/vcem-matrix/*`. | Requires gateway/data proxy to honor authorized events. |
| Independent audit verification. | `scripts/auditVerify.ts`, `scripts/verifyDeployedBytecode.ts` | RPC logs, transaction calldata, receipts, block metadata, ABI artifacts, local runtime bytecode. | `test/AuditVerifier.ts`, `evidence/audit/*` when run. | Requires deployed addresses and RPC access; denied events are only verified to the extent their emitted evidence permits. |
| Off-chain data proxy enforcement. | `services/data-proxy/*` | Receipt and event verification. | Fixture-level module. | Not a production API. |
| Authenticated one-time data release. | `services/auth/walletAuth.ts`, `services/data-proxy/secureProxy.ts`, `services/storage/artifactStore.ts`, `services/encryption/keyProvider.ts` | Session-bound receipt verification and delivery ledger. | `test/DataProxy.ts`. | Library/service layer only, no HTTP server. |
| FHIR R4 alignment. | `services/fhir-adapter/mapper.ts`, `services/fhir-adapter/vcemMapper.ts` | Fixture mapper and executor for real VCEM create/update/revoke calls plus AuditEvent output from real `AccessAuthorized` events. | `test/FHIRAdapter.ts`, `fixtures/fhir/*`, `docs/fhir-mapping.md` | No live FHIR server integration, SMART-on-FHIR authorization, or production profile validation. |
| ZKP VCEM extension. | `zkp/circuits/ConsentAccessProof.circom` | Experimental scaffold. | `npm run test:legacy:zkp` currently fails due proof/verifier mismatch. | Not baseline VCEM. |
| Reproducible benchmarking. | `benchmarks/*` | k6 and analysis scripts. | Raw outputs required. | No benchmark results claimed here. |
