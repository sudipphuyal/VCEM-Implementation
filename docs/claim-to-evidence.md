# Claim to Evidence

| Claim | Source module | Contract/service | Tests/evidence | Limitation |
| --- | --- | --- | --- | --- |
| Sensitive data remain off-chain. | `contracts/vcem/*` | VCEM contracts use hashes/IDs only. | `test/VCEM.ts` | Legacy contracts still store plaintext prototype strings. |
| Consent is versioned and revocable. | `VCEMConsent.sol` | `createConsent`, `updateConsent`, `revokeConsent`. | `test/VCEM.ts` | Participant wallet custody is assumed. |
| Actor set is cryptographically bound to consent. | `VCEMConsent.sol`, `CanonicalHash.sol` | Contract-sorted actor list and derived `actorsRoot`. | `test/VCEM.ts` | Bounded to 64 actor IDs per consent version. |
| Per-access consent-state binding. | `VCEMAudit.sol` | `authorizeAndLogAccess`. | `test/VCEM.ts`, `test/VCEMMatrix.ts`, `evidence/vcem/*`, `artifacts/vcem-matrix/*`. | Requires gateway/data proxy to honor authorized events. |
| Independent audit verification. | `scripts/auditVerify.ts` | On-chain logs only. | `evidence/audit/*` when run. | Historical signature calldata verification remains future work. |
| Off-chain data proxy enforcement. | `services/data-proxy/*` | Receipt and event verification. | Fixture-level module. | Not a production API. |
| FHIR R4 alignment. | `services/fhir-adapter/*` | Fixture mapper. | `docs/fhir-mapping.md` | No live FHIR server integration. |
| ZKP VCEM extension. | `zkp/circuits/ConsentAccessProof.circom` | Experimental scaffold. | `npm run test:legacy:zkp` currently fails due proof/verifier mismatch. | Not baseline VCEM. |
| Reproducible benchmarking. | `benchmarks/*` | k6 and analysis scripts. | Raw outputs required. | No benchmark results claimed here. |
