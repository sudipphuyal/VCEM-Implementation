# Final Alignment Plan

| Gap | Existing Files | Required Implementation | Tests | Evidence Artifact | Status |
| --- | --- | --- | --- | --- | --- |
| Historical consent versions mutate hashed status | `VCEMConsent.sol`, `VCEMTypes.sol`, `CanonicalHash.sol` | Preserve original version fields forever; derive supersession from later versions; revocation creates new `REVOKED` version only. | VCEM lifecycle tests and recomputation tests. | `evidence/vcem/*`, audit report when run. | Implemented |
| Data proxy reusable transaction hash risk | `services/data-proxy/*` | Add nonce auth, wallet identity binding, one-time delivery ledger, finality checks, and storage abstraction. | API/proxy integration tests. | Proxy test report. | Implemented as service layer, no HTTP server |
| Audit verifier lacks calldata signature/expiry checks | `scripts/auditVerify.ts` | Decode transaction calldata, recompute EIP-712 digests, verify expiry at block timestamp, verify request uniqueness and latest consent. | Audit verifier tamper tests. | `evidence/audit/*` | Partial; latest consent and policy checks implemented |
| FHIR fixture adapter is limited | `services/fhir-adapter/*` | Validate supported fixtures, map to canonical VCEM policy values, reject unsupported provisions, generate AuditEvent. | FHIR fixture tests. | FHIR test output. | Partial |
| Besu network scaffold is not generated | `infrastructure/besu/*` | Generate validator keys/genesis/static peers, run/verify nodes, deploy VCEM manifest. | Besu smoke tests. | Deployment manifest. | Pending |
| Matrix should have one authoritative path | `test/VCEM.ts`, `test/VCEMMatrix.ts` | Keep `VCEMMatrix.ts` as authoritative 60-case/120-outcome matrix; retire old 60-row smoke from claim docs. | `npm run test:vcem:matrix`. | `artifacts/vcem-matrix/*` | Partial |
| Benchmark scripts are not executable end-to-end | `benchmarks/*` | Wire to authenticated API/proxy and PostgreSQL RBAC/RLS baseline. | Benchmark smoke tests. | `benchmarks/raw`, `benchmarks/reports` when run. | Pending |
| Offline compiler not guaranteed | `hardhat.config.ts`, `package.json` | Add local `solc@0.8.20` and document remaining legacy 0.8.27 dependency. | Offline compile check. | CI logs. | Partial; local 0.8.20 wired |
| Legacy ZKP failures | ZKP contracts/tests/artifacts | Repair proof artifacts or keep explicit experimental isolation. | `npm run test:legacy:zkp`. | ZKP report. | Isolated, failing |
| Dependency/static-analysis findings | `package.json`, CI/config | Remediate safe upgrades, document breaking upgrades, run Solhint/Slither when available. | CI. | audit/static-analysis logs. | Partial |
