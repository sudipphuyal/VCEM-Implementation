# Final Alignment Baseline

Run date: 2026-07-03 on branch `upgrade-to-vcem`.

## Current Repository Status

The repository contains:

- VCEM contracts under `contracts/vcem/`;
- legacy DSA/RSA/resource certification contracts;
- isolated legacy Groth16/ZKP contracts and tests;
- TypeScript pseudonymization, FHIR, policy, data-proxy, and audit-verifier modules;
- Besu Docker scaffolding;
- benchmark scaffolding;
- VCEM unit tests and a 60-case/120-outcome matrix test;
- CI and static-analysis config stubs.

The working tree was clean at baseline.

## Baseline Checks

| Command | Result | Notes |
| --- | --- | --- |
| `npm ls --depth=0` | Pass | Dependencies are installed. |
| `npm run lint` | Pass | TypeScript typecheck passes. |
| `npm run compile` | Pass | Hardhat warns Node.js `v23.11.0` is unsupported. |
| `npm test` | Pass | Supported default suite: 58 passing after the final alignment changes. |
| `npm run test:vcem` | Pass | 6 passing. |
| `npm run test:legacy:zkp` | Fail | 1 passing, 3 failing due legacy proof/verifier mismatch. |
| `npm audit --audit-level=low` | Fail with findings | 59 vulnerabilities: 19 low, 24 moderate, 12 high, 4 critical. |
| `npm run slither` | Fail | `slither` is not installed. |

## Existing Test Failures

The supported default test suite is green. The isolated experimental legacy ZKP suite fails:

- `ABVerifier` returns `false` for the checked-in proof.
- `DataSharingAgreementZKP.createDsaWithProof` rejects the proof.
- `DataSharingAgreementZKP.acceptDsaWithProof` rejects the proof.

## Current Compile Failures

None in the supported compile path. Hardhat reports an unsupported Node.js version warning.

## Unresolved Security Findings

- `npm audit` reports 59 dependency vulnerabilities. Several suggested remediations require breaking Hardhat/Ethers upgrades.
- Slither is configured but unavailable in the local environment.
- Legacy DSA/RSA contracts retain plaintext prototype metadata and delete-on-revoke behavior; they are isolated from VCEM claims.
- Legacy ZKP proof artifacts are stale or mismatched.

## Claims Already Supported

- Participant-controlled creation, update, and revocation in VCEM contracts.
- Runtime access authorization checks active consent, actor, purpose, scope, data hash, request expiry, EIP-712 signature, and replay status.
- Authorized access events store consent version, consent hash, and actor root.
- Actor roots are derived from the enforced actor set.
- VCEM unit tests and matrix evidence support independently verifiable per-access consent-state binding in Hardhat.

## Claims Not Supported Yet

- Immutable historical status needed correction at baseline: prior consent versions were mutated to `SUPERSEDED`, which changed a field included in the consent hash.
- Authenticated one-time data delivery is implemented as a TypeScript service layer with provider-backed receipt lookup and a durable JSON-file delivery ledger. No HTTP API is implemented.
- Audit verifier does not yet validate signatures/expiry from calldata.
- FHIR adapter is fixture-level. It converts anonymized Consent fixtures into VCEM lifecycle call payloads and authorized access records into AuditEvent-shaped output; it is not live FHIR-server integration.
- Besu five-node network is scaffolded, not generated and validated.
- Benchmark scripts are not executable end-to-end against the authenticated API/proxy.
- ZKP authorization proof is not implemented.

## Remaining Gap File Map

| Gap | Affected files |
| --- | --- |
| Historical consent mutation | `contracts/vcem/VCEMConsent.sol`, `contracts/vcem/VCEMTypes.sol`, `scripts/auditVerify.ts`, `test/VCEM.ts`, docs |
| Authenticated data proxy | `services/data-proxy/*`, `services/auth/*`, `services/storage/*`, `services/encryption/*`, `test/DataProxy.ts`, missing HTTP API |
| Audit verifier completeness | `scripts/auditVerify.ts`, missing `services/audit-verifier`, docs/tests |
| FHIR contract-call mapping | `services/fhir-adapter/*`, `services/policy/model.ts`, `fixtures/fhir/*`, `test/FHIRAdapter.ts`, docs |
| Besu generation/validation | `infrastructure/besu/*`, `package.json`, docs |
| Matrix authority | `test/VCEM.ts`, `test/VCEMMatrix.ts`, `docs/vcem-test-matrix.md` |
| Benchmark execution | `benchmarks/*`, missing API/proxy workload commands |
| Offline compiler | `package.json`, `hardhat.config.ts` |
| Legacy ZKP | `contracts/DataSharingAgreementZKP.sol`, `contracts/ABVerifier.sol`, `test/*ZKP*`, `circuits/*`, docs |
