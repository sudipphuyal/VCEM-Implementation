# Open Source Release Inventory

This file maps the release checklist to concrete repository paths. Generated secrets and local runtime keys are intentionally excluded from Git.

| Required artifact | Status | Repository path(s) |
|---|---|---|
| Solidity contracts | Present | `contracts/`, especially `contracts/vcem/VCEMRegistry.sol`, `contracts/vcem/VCEMConsent.sol`, `contracts/vcem/VCEMAudit.sol` |
| Besu configuration | Present | `infrastructure/besu/docker-compose.yml`, `infrastructure/besu/genesis.json.template`, `infrastructure/besu/config/`, `infrastructure/besu/scripts/` |
| Deployment scripts | Present | `ignition/modules/VCEM.ts`, `scripts/writeDeploymentManifest.ts`, `infrastructure/besu/scripts/deployVcem.ts`, `scripts/verifyDeployedBytecode.ts` |
| Benchmark scripts | Present | `benchmarks/k6/`, `benchmarks/scripts/`, `benchmarks/baseline/postgres-rls.sql` |
| Raw benchmark logs | Present | `benchmarks/raw/baseline/`, `benchmarks/raw/vcem/`, `benchmarks/raw/run-index-*.json` |
| Benchmark summaries/reports | Present | `benchmarks/analysis/summary.json`, `benchmarks/analysis/summary.csv`, `benchmarks/reports/benchmark-report.md` |
| Unit tests | Present | `test/VCEM.ts`, `test/DataSharingAgreement.ts`, `test/Registries.ts`, `test/ResourceCertification.ts`, `test/ResourcesSharingAgreement.ts` |
| Integration tests | Present | `test/ApiDataProxy.ts`, `test/DataProxy.ts`, `test/FHIRAdapter.ts`, `test/AuditVerifier.ts`, `test/VCEMMatrix.ts` |
| Slither reports | Present | `slither-report.md`, `reports/slither/slither-final.json`, `reports/slither/slither-final.txt`, `reports/slither/slither-reviewer2-20260807.json`, `reports/slither/slither-reviewer2-20260807.txt`, `reports/slither/slither-disposition.csv`, `reports/slither/SLITHER_DISPOSITION_SUMMARY.md` |
| Reviewer 2 security invariant evidence | Present | `test/VCEMSecurityProperty.ts`, `reports/security/VCEM_SECURITY_INVARIANTS.md` |
| HL7/FHIR examples | Present | `fixtures/fhir/*.json`, `services/fhir-adapter/fixtures/consent.anonymized.json`, `docs/fhir-mapping.md`, `docs/fhir-limitations.md` |
| HL7/FHIR validation reports | Present | `reports/fhir-validation/` peer-review/revision validation artifacts |
| README reproduction instructions | Present | `README.md` |
| Dependency manifests | Present | `package.json`, `package-lock.json`, `requirements.txt` |
| License | Present | `LICENSE`, `package.json` license field |

## Intentionally Excluded Runtime Secrets

The following generated files can exist locally but are ignored and must not be committed:

- `.env`
- `.env.local`
- `infrastructure/besu/generated/`
- `infrastructure/besu/validators/`
- `infrastructure/besu/rpc/`
- `benchmarks/raw/fixtures/vcem-actors.json`
- `benchmarks/raw/fixtures/vcem-keys.json`
- `benchmarks/raw/fixtures/vcem-artifacts/`

Use `.env.example`, `infrastructure/besu/genesis.json.template`, and `npm run besu:generate-network` to regenerate local-only runtime materials.
