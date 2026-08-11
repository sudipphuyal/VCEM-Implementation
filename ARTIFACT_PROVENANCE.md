# VCEM Artifact Provenance Manifest

## 1. Purpose

This manifest documents the provenance of the software, configuration, synthetic fixtures, benchmark workloads, raw outputs, analysis artifacts, security reports, figures, tables, and algorithms associated with the manuscript:

> **Blockchain-Based Governance System for Consent-Aware Authorization and Audit in Digital Clinical Research: Implementation and Experimental Evaluation**

It also distinguishes the present Verifiable Consent Enforcement Model (VCEM) study from the authors’ prior publications:

1. S. Phuyal, M. Bhandari, R. Bista, and J. C. Ferreira, “Enabling Cross-Institution Health Data Sharing in Norway: EUDI Wallets, On-Chain Consent, and openEHR↔FHIR Translation,” _IEEE Access_, vol. 14, pp. 20309–20327, 2026, doi: 10.1109/ACCESS.2026.3661642.
2. S. Phuyal, M. Bhandari, R. Bista, and J. C. Ferreira, “HL7 FHIR Consent for Healthcare Data Sharing: Challenges, Opportunities and Integrity Implications,” _International Journal of Medical Informatics_, vol. 214, Art. no. 106405, 2026, doi: 10.1016/j.ijmedinf.2026.106405.

This manifest was added during peer-review revision. It documents, but does not alter, the evaluated contracts, workloads, raw results, or analysis outputs.

---

## 2. Repository, branch, version, and release chronology

| Field                                                          | Verified value                                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| GitHub repository                                              | https://github.com/sudipphuyal/zkp-with-snarkjs                      |
| VCEM source branch                                             | `upgrade-to-vcem`                                                    |
| VCEM branch URL                                                | https://github.com/sudipphuyal/zkp-with-snarkjs/tree/upgrade-to-vcem |
| Declared software version date used in the manuscript citation | **30 June 2026**                                                     |
| First public VCEM upgrade commit visible in the branch history | `1486dcc` on 2 July 2026                                             |
| Preserved audit-validation deployment commit                   | `6077d27a9eca686e5395e8e081bbbf588b824a0b`                           |
| Preserved audit-validation deployment date                     | 4 July 2026                                                          |
| Formal 10–200 VU evaluation branch commit                      | `a493a2c0f6028e52cee6c09b1fc748c2bc8e14e6`                           |
| Formal evaluation branch commit message                        | `Add final 10-200 VU formal evaluation summaries`                    |
| Integrated revised implementation commit                       | `64f185d2f412c45e439827c21ccb509aa38d9531`                           |
| Integrated revision commit message                             | `Merge formal 10-200 VU evaluation into revision branch`             |
| Earlier public release-packaging commit                        | `c7d88c8c87fe47192683992e8ed9f715fbf74161`                           |
| Software license                                               | MIT License                                                          |
| Copyright                                                      | Copyright (c) 2026 Sudip Phuyal                                      |
| GitHub release/tag status when this manifest was prepared      | No GitHub release or tag was present                                 |
| Zenodo record title                                            | `VCEM Final Implementation`                                          |
| Zenodo record                                                  | https://zenodo.org/records/21083735                                  |
| Zenodo DOI                                                     | https://doi.org/10.5281/zenodo.21083735                              |
| Archived file                                                  | `zkp-with-snarkjs.zip`                                               |
| Archived-file size                                             | 204.5 MB                                                             |
| Archived-file MD5                                              | `a3bcbf92808e8ce0f6915e452c7a09b4`                                   |

### Date interpretation

The date **30 June 2026** is the software version date used in the manuscript and software citation. The public Git history shows that the VCEM branch was committed and packaged between 2 and 6 July 2026. Therefore, 30 June 2026 must not be interpreted as the Git commit date, public GitHub release date, deployment timestamp, or Zenodo publication date.

For exact technical reproduction, use the full commit identifiers above rather than relying on the software version date alone.

### Evaluation provenance identifiers

Three provenance states are distinguished in the revised study:

| Provenance state                      | Commit                                     | Meaning                                                                                                                                      |
| ------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserved audit-validation deployment | `6077d27a9eca686e5395e8e081bbbf588b824a0b` | Deployment state used for the preserved on-chain authorization population and exhaustive audit reconstruction                                |
| Formal 10–200 VU evaluation branch    | `a493a2c0f6028e52cee6c09b1fc748c2bc8e14e6` | Formal evaluation harness, transaction-path corrections, instrumentation, and final summary artifacts for the completed performance campaign |
| Integrated revised implementation     | `64f185d2f412c45e439827c21ccb509aa38d9531` | Integration of the formal performance-evaluation lineage with the audit-integrity and temporal-semantics reviewer-validation work            |

The preserved audit-validation deployment and the formal performance campaign are distinct experimental populations and must not be conflated. Commit `6077d27...` remains the provenance anchor for the preserved 4,240-event audit-validation deployment. The formal 10–200 VU performance results derive from the later formal-evaluation campaign whose source, harness, instrumentation, and summary artifacts are represented by `a493a2c...`. The complete raw formal-run evidence is maintained separately for immutable archival and should be cited using the final archive identifier once deposited.

A final annotated Git tag should be created only after the present provenance documentation has been synchronized with the completed revision.

---

## 3. Provenance-status definitions

- **New for VCEM:** developed specifically for the present VCEM study.
- **Adapted:** based on an earlier internal component, public standard, or open-source tool and modified for the present study.
- **Shared technical dependency:** a general-purpose technology used in multiple studies, such as Hyperledger Besu, Solidity, Hardhat, Docker, Circom, snarkJS, PostgreSQL, k6, or HL7 FHIR.
- **Legacy artifact retained for provenance:** retained in the repository but explicitly excluded from evidence supporting the present VCEM claims.
- **Not reused:** not used to generate the present manuscript’s experimental results.
- **Conceptual precursor only:** informed the research question or architecture but supplied no executable artifact or empirical result reused in the present study.

---

## 4. Relationship to the prior IEEE Access implementation

### 4.1 Prior publication

The prior IEEE Access article is:

- **Title:** Enabling Cross-Institution Health Data Sharing in Norway: EUDI Wallets, On-Chain Consent, and openEHR↔FHIR Translation
- **IEEE Xplore:** https://ieeexplore.ieee.org/document/11373172
- **DOI:** https://doi.org/10.1109/ACCESS.2026.3661642
- **Publication date:** 6 February 2026
- **Current-version date:** 11 February 2026
- **Pages:** 20309–20327
- **License:** Creative Commons Attribution 4.0

That study evaluated an EUDI-compatible health-wallet architecture combining professional identity, verifiable credentials, on-chain consent, Groth16 zero-knowledge-proof verification, and openEHR↔FHIR translation in a simulated Norwegian healthcare workflow.

### 4.2 Prior artifacts and their status in VCEM

| Prior artifact or function              | Role in the prior IEEE Access study                                        | Status in the present VCEM evidence                                  |
| --------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `CredentialRegistry`                    | DID and professional-credential management                                 | Not used as a VCEM core contract                                     |
| `ConsentAgreement`                      | Data-sharing agreement, consent, revocation, and emergency-event recording | Not used as a VCEM core contract                                     |
| `ZKPVerifier`                           | On-chain Groth16 proof verification                                        | Not used in the reported VCEM authorization benchmark                |
| `contracts/DSA/`                        | Legacy data-sharing agreement contracts                                    | Retained for compatibility and provenance; excluded from VCEM claims |
| `contracts/RSA/`                        | Legacy resource-sharing agreement contracts                                | Retained for compatibility and provenance; excluded from VCEM claims |
| `contracts/DataSharingAgreementZKP.sol` | Legacy experimental ZKP agreement contract                                 | Retained for provenance; excluded from VCEM claims                   |
| `contracts/ABVerifier.sol`              | Retained generated Groth16 verifier                                        | Retained for provenance; excluded from VCEM authorization claims     |
| `circuits/PatientIdProof.circom`        | Legacy proof circuit                                                       | Retained as experimental legacy material                             |
| `circuits/DsaAgreementProof.circom`     | Legacy agreement proof circuit                                             | Retained as experimental legacy material                             |
| EUDI-compatible wallet workflow         | Credential presentation and identity workflow                              | Not used in the reported VCEM benchmark                              |
| Groth16/Poseidon authorization workflow | Privacy-preserving authorization in the prior system                       | Not used as the present consent-state-binding mechanism              |
| openEHR↔FHIR translation bridge         | Bidirectional clinical-data translation                                    | Not reused as the present FHIR Consent fixture adapter               |
| Prior synthetic hospital/ICU data       | Prior workflow dataset                                                     | Not reused as the present VCEM dataset                               |
| Prior 10–100 parallel-event benchmark   | Prior heterogeneous system evaluation                                      | Not reused as the present k6 authorization workload                  |
| Prior raw logs and numerical results    | Evidence for the prior publication                                         | Not reported as new evidence in the present manuscript               |
| Prior figures, algorithms, and text     | Presentation of the prior study                                            | Not presented as new material in the present manuscript              |

The studies share established technologies and architectural principles, including Hyperledger Besu, Solidity, permissioned blockchain operation, off-chain clinical data, cryptographic anchoring, and standards-aware health-data governance. These are shared technical foundations, not reused empirical results.

---

## 5. Relationship to the prior FHIR Consent analysis

The prior _International Journal of Medical Informatics_ article is:

- **Title:** HL7 FHIR Consent for Healthcare Data Sharing: Challenges, Opportunities and Integrity Implications
- **DOI:** https://doi.org/10.1016/j.ijmedinf.2026.106405
- **Journal:** International Journal of Medical Informatics
- **Volume and article number:** 214, 106405
- **Study type:** qualitative critical analysis and architectural synthesis

That article distinguishes:

1. standards-based consent representation;
2. local policy interpretation and runtime enforcement; and
3. cross-organizational integrity verification.

It is a **conceptual precursor only**. It did not provide the VCEM smart contracts, API, benchmark workload, synthetic experimental dataset, raw logs, gas measurements, Slither results, or VCEM numerical results. No executable artifact or experimental measurement from that paper is reported as new evidence in the present manuscript.

---

## 6. VCEM core smart contracts

| Repository path                               | Purpose                                                                                                                                                                                                            | Provenance status | Manuscript evidence supported                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------- |
| `contracts/vcem/VCEMRegistry.sol`             | Pseudonymous actor identifiers, wallet-to-actor mapping, participant/researcher/custodian/gateway/auditor roles, role revocation, actor revocation, wallet update, and pause controls                              | New for VCEM      | System architecture; registry implementation; actor validation      |
| `contracts/vcem/VCEMConsent.sol`              | Participant-controlled consent creation, update, revocation, immutable version history, canonical SHA-256 consent chaining, purpose mask, scope hash, actor set, actor root, and version-specific actor membership | New for VCEM      | Definition 1; Algorithm 1; consent lifecycle                        |
| `contracts/vcem/VCEMAudit.sol`                | EIP-712 request verification, expiry, replay protection, current consent lookup, actor/role/purpose/scope/data-hash/expected-consent-hash checks, and `AccessAuthorized` event recording                           | New for VCEM      | Definitions 2–3; Algorithms 2–3; authorization and audit evaluation |
| `contracts/vcem/VCEMTypes.sol`                | Shared VCEM data structures and types                                                                                                                                                                              | New for VCEM      | Contract data model                                                 |
| `contracts/vcem/libraries/CanonicalHash.sol`  | Canonical consent-state hash construction                                                                                                                                                                          | New for VCEM      | Consent-state chaining and reconstruction                           |
| `contracts/vcem/interfaces/IVCEMConsent.sol`  | Typed consent-contract interface used during authorization                                                                                                                                                         | New for VCEM      | Runtime consent lookup                                              |
| `contracts/vcem/interfaces/IVCEMRegistry.sol` | Typed registry-contract interface used during authorization                                                                                                                                                        | New for VCEM      | Registry and role checks                                            |

The core VCEM contracts are distinct from the legacy `CredentialRegistry`, `ConsentAgreement`, and `ZKPVerifier` responsibilities described in the prior IEEE Access paper.

---

## 7. Off-chain services

| Repository path                                          | Purpose                                                                                                             | Provenance status                                | Manuscript evidence supported                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| `services/api/`                                          | TypeScript API for authentication, authorization relay, and release coordination                                    | New for VCEM                                     | Application and integration layers                                |
| `services/api/server.ts`                                 | API endpoints for authentication, authorization, and release                                                        | New for VCEM                                     | API workflow                                                      |
| `services/api/migrations/001_vcem_api.sql`               | PostgreSQL schema for sessions and delivery-ledger state                                                            | New for VCEM                                     | Authenticated API and one-time release                            |
| `services/auth/`                                         | Wallet challenge, signature verification, registry-backed identity resolution, short-lived sessions, and revocation | New for VCEM                                     | Requester authentication                                          |
| `services/auth/walletAuth.ts`                            | Wallet challenge and signature workflow                                                                             | New for VCEM                                     | Authenticated request path                                        |
| `services/auth/registryIdentity.ts`                      | Resolves authenticated wallets through `VCEMRegistry`                                                               | New for VCEM                                     | Identity and role verification                                    |
| `services/data-proxy/policyProxy.ts`                     | Policy-enforcing data-delivery proxy                                                                                | New for VCEM                                     | Gateway-mediated authorized release                               |
| `services/data-proxy/secureProxy.ts`                     | Secure receipt and authorization-event checks                                                                       | New for VCEM                                     | Data-proxy enforcement                                            |
| `services/data-proxy/deliveryLedger.ts`                  | One-time release ledger and duplicate-release prevention                                                            | New for VCEM                                     | Replay-resistant release path                                     |
| `services/data-proxy/proxy.ts`                           | Older insecure demonstration helper                                                                                 | Legacy/demo only; not production-facing evidence |
| `services/encryption/keyProvider.ts`                     | AES-256-GCM development key-provider abstraction and erasure support                                                | New for VCEM                                     | Encrypted fixture storage and cryptographic erasure demonstration |
| `services/storage/artifactStore.ts`                      | Encrypted synthetic artifact storage                                                                                | New for VCEM                                     | Off-chain data storage                                            |
| `services/pseudonymization/`                             | HMAC-SHA-256 pseudonymous identifier derivation                                                                     | New for VCEM                                     | Pseudonymization implementation                                   |
| `services/fhir-adapter/vcemMapper.ts`                    | Maps supported anonymized FHIR R4 Consent fixtures into VCEM lifecycle calls                                        | New for VCEM                                     | Table IV and fixture-based mapping                                |
| `services/fhir-adapter/mapper.ts`                        | FHIR fixture parsing and deterministic mapping support                                                              | New for VCEM                                     | FHIR adapter                                                      |
| `services/fhir-adapter/fixtures/consent.anonymized.json` | Synthetic anonymized FHIR R4 Consent fixture                                                                        | New for VCEM                                     | FHIR mapping test                                                 |
| `fixtures/fhir/`                                         | FHIR examples used by the adapter and tests                                                                         | New for VCEM                                     | Fixture-based FHIR demonstration                                  |

FHIR support in this repository is fixture-based. It is not evidence of live FHIR-server integration, SMART-on-FHIR deployment, or production profile certification.

---

## 8. Independent audit and deployment verification

| Repository path                                 | Purpose                                                                                                                                                                                                                                                                    | Provenance status       | Manuscript evidence supported                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------ |
| `scripts/auditVerify.ts`                        | Reconstructs registry, consent, data-hash, access, and denial evidence from chain logs; sorts ledger events; recomputes consent hashes and actor roots; validates authorization events; decodes calldata; reconstructs the EIP-712 domain and message; recovers the signer | New for VCEM            | Audit reconstruction independently of application-layer logs |
| `scripts/verifyDeployedBytecode.ts`             | Compares deployed runtime bytecode with locally compiled artifacts                                                                                                                                                                                                         | New for VCEM            | Deployment-integrity verification                            |
| `scripts/writeDeploymentManifest.ts`            | Writes deployment metadata and bytecode hashes                                                                                                                                                                                                                             | New for VCEM            | Reproducibility                                              |
| `deployments/vcem-manifest.json`                | Chain ID, validator topology, contract addresses, deployment transaction hashes, ABI version, runtime bytecode hashes, Git commit, and deployment timestamp                                                                                                                | Generated VCEM evidence | Deployment reproduction                                      |
| `ignition/modules/VCEM.ts`                      | VCEM contract deployment module                                                                                                                                                                                                                                            | New for VCEM            | Contract deployment                                          |
| `infrastructure/besu/scripts/deployVcem.ts`     | Deploys VCEM contracts to the local Besu network                                                                                                                                                                                                                           | New for VCEM            | Besu deployment                                              |
| `infrastructure/besu/scripts/besuNetwork.ts`    | Generates and manages the local network                                                                                                                                                                                                                                    | New for VCEM            | Local five-node testbed                                      |
| `infrastructure/besu/scripts/validateConfig.ts` | Validates the Besu configuration                                                                                                                                                                                                                                           | New for VCEM            | Configuration reproducibility                                |

### Recorded deployment identity

`deployments/vcem-manifest.json` records:

- chain ID: `20260703`;
- network name: `vcem-besu-local`;
- consensus: IBFT 2.0;
- block period: 2 seconds;
- four validator nodes;
- one non-validator RPC node;
- deployment timestamp: `2026-07-05T18:55:17.498Z`;
- Git commit: `6077d27a9eca686e5395e8e081bbbf588b824a0b`.

---

## 9. Besu infrastructure

| Repository path                             | Purpose                                                                   | Provenance status                                              | Manuscript evidence supported     |
| ------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| `infrastructure/besu/docker-compose.yml`    | Co-located logical five-node Besu topology                                | Adapted/shared infrastructure                                  | Experimental environment          |
| `infrastructure/besu/genesis.json.template` | IBFT 2.0 genesis template                                                 | Adapted/shared infrastructure                                  | Consensus and block configuration |
| `infrastructure/besu/scripts/`              | Network generation, startup, status, deployment, and verification scripts | New/adapted for VCEM                                           | Reproducible deployment           |
| `infrastructure/besu/generated/`            | Locally generated network configuration                                   | Generated and ignored from Git where key material is sensitive | Runtime deployment only           |
| `infrastructure/besu/validators/`           | Generated validator data                                                  | Generated and ignored from Git                                 | Runtime deployment only           |
| `infrastructure/besu/rpc/`                  | Generated RPC-node data                                                   | Generated and ignored from Git                                 | Runtime deployment only           |

The testbed is a **co-located logical five-node network**, not evidence of geographically or organizationally independent validator governance.

---

## 10. Functional, adversarial, property, and integration tests

| Repository path                                        | Purpose                                                                                           | Manuscript evidence supported                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `test/VCEM.ts`                                         | Core registry, consent, authorization, expiry, replay, purpose, scope, actor, and data-hash tests | Functional correctness                            |
| `test/VCEMMatrix.ts`                                   | Authoritative 60-case and 120-outcome correctness matrix                                          | Zero observed false positives and false negatives |
| `test/AuditVerifier.ts`                                | Audit-verifier reconstruction and tamper-detection tests                                          | Independent verification                          |
| `test/DataProxy.ts`                                    | Data-proxy release and bypass-prevention tests                                                    | Gateway-mediated release                          |
| `test/ApiDataProxy.ts`                                 | Authenticated API and one-time release tests                                                      | API/data-proxy enforcement                        |
| `test/FHIRAdapter.ts`                                  | FHIR fixture-to-contract lifecycle tests                                                          | Fixture-based FHIR mapping                        |
| `test/VCEMProperty.ts`                                 | Property tests for canonical consent hashing                                                      | Consent-hash invariants                           |
| `artifacts/vcem-matrix/vcem-correctness-matrix.json`   | Machine-readable correctness matrix                                                               | Consent-enforcement evidence                      |
| `artifacts/vcem-matrix/vcem-correctness-matrix.csv`    | Tabular correctness matrix                                                                        | Consent-enforcement evidence                      |
| `artifacts/vcem-matrix/vcem-concurrency-ordering.json` | Controlled access-versus-update ordering evidence                                                 | Temporal ordering tests                           |
| `artifacts/vcem-matrix/vcem-concurrency-ordering.csv`  | Tabular concurrency-ordering evidence                                                             | Temporal ordering tests                           |
| `evidence/audit/`                                      | Full or sampled audit-verification reports                                                        | Audit-reconstruction result                       |

The repository records 85 passing tests in the release-ready documentation, while focused suites include the VCEM matrix, audit verifier, FHIR adapter, API/proxy, and property tests.

---

## 11. Benchmark implementation

| Repository path                          | Purpose                                                                    | Provenance status              | Manuscript evidence supported |
| ---------------------------------------- | -------------------------------------------------------------------------- | ------------------------------ | ----------------------------- |
| `benchmarks/k6/vcem-access.js`           | k6 workload for the authenticated VCEM authorization and secure-proxy path | New for the present evaluation | Tables III and VII; Figure 2  |
| `benchmarks/k6/baseline-access.js`       | k6 workload for the PostgreSQL baseline                                    | New for the present evaluation | Tables VI and VII; Figure 2   |
| `benchmarks/scripts/seed.ts`             | Seeds deterministic baseline fixtures                                      | New for the present evaluation | Benchmark setup               |
| `benchmarks/scripts/seedVcem.ts`         | Seeds deterministic VCEM fixtures and on-chain state                       | New for the present evaluation | Benchmark setup               |
| `benchmarks/scripts/run.ts`              | Orchestrates benchmark levels and repetitions                              | New for the present evaluation | Benchmark protocol            |
| `benchmarks/scripts/analyze.ts`          | Produces benchmark summaries                                               | New for the present evaluation | Tables and figure inputs      |
| `benchmarks/scripts/smokeBaseline.ts`    | Baseline smoke test                                                        | New for the present evaluation | Baseline validation           |
| `benchmarks/scripts/vcemServer.ts`       | VCEM benchmark service path                                                | New for the present evaluation | VCEM workload                 |
| `benchmarks/baseline/postgres-rls.sql`   | PostgreSQL RBAC/RLS baseline schema and policies                           | New for the present evaluation | Minimal centralized baseline  |
| `benchmarks/baseline/server.ts`          | Baseline authorization and release server                                  | New for the present evaluation | Baseline application path     |
| `benchmarks/analysis/summary.json`       | Machine-readable aggregated benchmark summary                              | Generated evidence             | Tables III, VI, and VII       |
| `benchmarks/analysis/summary.csv`        | Tabular aggregated benchmark summary                                       | Generated evidence             | Tables III, VI, and VII       |
| `benchmarks/reports/benchmark-report.md` | Generated benchmark report                                                 | Generated evidence             | Performance section           |

### Benchmark protocol

The finalized formal benchmark protocol defines:

- 10, 25, 50, 75, 100, 125, 150, 175, and 200 concurrent VUs;
- 60-second warm-up;
- 300-second measurement window;
- five independent repetitions per load level;
- deterministic fixture preparation;
- controlled reset/restore procedures;
- separate VCEM and minimal PostgreSQL RBAC/RLS authorization-reference workloads;
- per-run application, k6, transaction-relay, RPC, Besu, and resource telemetry where applicable.

All five retained formal repetitions at every evaluated load level completed with zero failed workflows for both benchmark arms. The independent run is the statistical unit for run-level descriptive summaries.

The retained formal metrics include completed authorization-workflow throughput, end-to-end application latency, run-level p50 and p95 latency, transaction-confirmation behavior, workflow failure rate, relay queue behavior, nonce allocation and submission outcomes, RPC submission behavior, transaction-pool state, Besu execution queues, block progression, gas usage, peer-message counters, and container CPU/memory utilization where instrumented.

---

## 12. Performance-evaluation evidence

The repository contains both historical revision-time benchmark artifacts and the later finalized formal campaign. Historical failed or incomplete benchmark runs are retained for provenance but are not used to calculate the final manuscript performance results.

| Repository path                                                                   | Meaning                                                                                                 | Manuscript treatment                                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `benchmarks/raw/vcem/`                                                            | Historical pre-formal VCEM benchmark evidence, including earlier failed/incomplete higher-load attempts | Historical provenance only; not used for the finalized 10–200 VU performance table |
| `benchmarks/raw/baseline/`                                                        | Historical pre-formal PostgreSQL-reference benchmark evidence                                           | Historical provenance only where superseded by the formal campaign                 |
| `benchmarks/formal-evaluation/PROTOCOL.md`                                        | Frozen formal evaluation protocol                                                                       | Defines the finalized 10–200 VU campaign                                           |
| `benchmarks/formal-evaluation/runFormal.ts`                                       | Formal campaign orchestrator                                                                            | Executes nine load levels and five repetitions per level                           |
| `benchmarks/formal-evaluation/k6/vcem-access.js`                                  | Formal VCEM workload                                                                                    | Formal VCEM performance evidence                                                   |
| `benchmarks/formal-evaluation/k6/baseline-access.js`                              | Formal PostgreSQL-reference workload                                                                    | Formal centralized-reference performance evidence                                  |
| `benchmarks/formal-evaluation/formalMonitor.ts`                                   | Component-level monitoring                                                                              | Bottleneck characterization                                                        |
| `benchmarks/formal-evaluation/analysis/formal-performance-summary.csv`            | Final run-level performance summary                                                                     | VCEM and PostgreSQL-reference performance tables and Figure 2                      |
| `benchmarks/formal-evaluation/analysis/concern13-container-resources-per-run.csv` | Formal per-run container-resource summary                                                               | Component-level bottleneck analysis                                                |
| Formal raw-results archive                                                        | Full retained run evidence for the completed formal campaign                                            | To be identified by the final immutable archive DOI/version                        |

The finalized formal dataset contains five valid repetitions for each benchmark arm at 10, 25, 50, 75, 100, 125, 150, 175, and 200 VUs, with zero failed workflows in the retained formal runs. Earlier failed or incomplete benchmark attempts remain provenance artifacts and are not transformed into formal performance estimates.

---

## 13. Security and quality evidence

| Repository path                                             | Purpose                                                                                                                                             | Manuscript evidence supported        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `slither-report.md`                                         | Human-readable Slither summary and interpretation                                                                                                   | Table II                             |
| `reports/slither/slither-final.json`                        | Machine-readable Slither results                                                                                                                    | Table II                             |
| `reports/slither/slither-final.txt`                         | Text Slither report                                                                                                                                 | Table II                             |
| `reports/slither.zip`                                       | Packaged Slither evidence                                                                                                                           | Security artifact                    |
| `reports/reviewer2-smart-contract-verification-report.docx` | Reviewer-facing contract-verification report                                                                                                        | Revision evidence                    |
| `reports/build_reviewer2_report.py`                         | Generates the reviewer-facing report                                                                                                                | Reproducibility                      |
| `slither.config.json`                                       | Slither configuration                                                                                                                               | Static-analysis reproducibility      |
| `.solhint.json`                                             | Solidity lint configuration                                                                                                                         | Code-quality evidence                |
| `.github/workflows/`                                        | CI workflows for compile, tests, matrix, FHIR, property tests, coverage, gas, Besu validation, Slither, dependency audit, secret scan, and Gitleaks | Continuous verification              |
| `package-lock.json`                                         | Pinned Node/Hardhat/TypeScript dependencies                                                                                                         | Dependency reproducibility           |
| `requirements.txt`                                          | Pinned Python and report-generation dependencies                                                                                                    | Tooling reproducibility              |
| `hardhat.config.ts`                                         | Solidity compiler and Hardhat configuration                                                                                                         | Compilation and test reproducibility |
| `LICENSE`                                                   | MIT License                                                                                                                                         | Release terms                        |

Recorded Slither status:

- High: 0
- Medium: 0
- Low: 48
- Informational: 120

These results do not prove the absence of exploitable vulnerabilities. They document the output of the stated static-analysis configuration.

---

## 14. Claim-to-evidence and reproducibility documentation

| Repository path                         | Purpose                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/claim-to-evidence.md`             | Maps manuscript claims to exact contracts, services, tests, deployment artifacts, audit commands, benchmarks, raw evidence, and limitations |
| `docs/final-vcem-alignment-report.md`   | Summarizes implementation-to-manuscript alignment                                                                                           |
| `docs/open-source-release-inventory.md` | Lists release artifacts and readiness                                                                                                       |
| `docs/benchmark-methodology.md`         | Documents benchmark design and interpretation                                                                                               |
| `docs/besu-deployment.md`               | Documents Besu topology and deployment                                                                                                      |
| `docs/audit-verification.md`            | Documents audit reconstruction                                                                                                              |
| `docs/fhir-mapping.md`                  | Documents supported FHIR mappings                                                                                                           |
| `docs/fhir-limitations.md`              | Documents unsupported FHIR semantics                                                                                                        |
| `docs/threat-model.md`                  | Documents assets, trust boundaries, threats, controls, and limitations                                                                      |
| `docs/privacy-and-erasure.md`           | Documents pseudonymization and erasure assumptions                                                                                          |
| `docs/reproducibility.md`               | Reproduction workflow                                                                                                                       |
| `docs/dependency-risk-register.md`      | Records unresolved dependency risks                                                                                                         |
| `docs/security-fixes.md`                | Records security-related remediation                                                                                                        |
| `docs/paper-delta.md`                   | Documents the difference between the manuscript and implementation                                                                          |
| `README.md`                             | Primary operational and reproducibility guide                                                                                               |
| `ARTIFACT_PROVENANCE.md`                | This provenance manifest                                                                                                                    |

---

## 15. Figures, tables, and algorithms

| Manuscript item                                                | Provenance                                 | Primary evidence                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Figure 1: VCEM layered architecture                            | Newly created for the present manuscript   | VCEM contracts and services                                                                        |
| Figure 2: formal application-latency and throughput comparison | Newly generated for the present manuscript | `benchmarks/formal-evaluation/analysis/formal-performance-summary.csv` and formal raw-run evidence |
| Figure 3: future-extension architecture                        | Newly created conceptual figure            | Future-work discussion; not experimental evidence                                                  |
| Static-analysis table                                          | New for the present study                  | Slither reports                                                                                    |
| VCEM performance table                                         | New for the present study                  | Formal VCEM 10–200 VU campaign, five repetitions per load level                                    |
| FHIR mapping table                                             | New for the present study                  | FHIR adapter, fixtures, tests, and mapping documentation                                           |
| PostgreSQL authorization-reference table                       | New for the present study                  | Formal PostgreSQL RBAC/RLS 10–200 VU campaign, five repetitions per load level                     |
| Combined performance comparison / Figure 2                     | New for the present study                  | Formal VCEM and PostgreSQL-reference campaign summaries and raw evidence                           |
| Algorithm 1                                                    | Newly formulated for VCEM                  | `VCEMConsent.sol`                                                                                  |
| Algorithm 2                                                    | Newly formulated for VCEM                  | `VCEMAudit.sol`                                                                                    |
| Algorithm 3                                                    | Newly formulated for VCEM                  | `VCEMAudit.sol` and `AccessAuthorized`                                                             |
| Algorithm 4                                                    | Newly formulated for VCEM                  | SHA-256 artifact-integrity workflow                                                                |

No figure, table, algorithm, benchmark result, or raw log from references [3] or [9] is presented as new evidence in the present manuscript.

---

## 16. Exact scientific result unique to the present study

The specific scientific result evaluated in the present manuscript is:

> Each recorded gateway-mediated authorization event is bound to the exact versioned consent state used by the smart-contract authorization decision through the stored consent version and canonical consent hash, together with the requester, participant, purpose, scope, actor-set root, registered data hash, request identifier, and blockchain timestamp. The recorded authorization decision can subsequently be reconstructed and checked from blockchain evidence independently of application-layer logs.

This result is narrower than demonstrating:

- actual delivery of the off-chain artifact;
- requester retrieval or decryption;
- downstream use only for the declared purpose;
- deletion of downstream copies;
- legal or regulatory compliance;
- production deployment;
- institutional-scale scalability; or
- live FHIR interoperability.

The present evidence supports an implementation-level claim concerning consent-aware authorization governance, tamper-evident recording, audit reconstruction, and controlled experimental evaluation within the defined single-institution testbed. It does not establish production readiness, operational clinical deployment, institutional-scale capacity, or geographically distributed performance.

---

## 17. Reproduction commands

From the repository root:

```bash
npm ci
HARDHAT_DISABLE_DOWNLOADS=true npm run compile
npm test
npm run test:vcem
npm run test:vcem:matrix
npm run test:audit-verifier
npm run test:fhir
npm run test:api
npm run test:property
npm run gas
npm run slither
npm run besu:config:validate
```

Local Besu deployment:

```bash
npm run besu:generate-network
npm run besu:up
npm run besu:status
npm run besu:verify
HARDHAT_DISABLE_DOWNLOADS=true npm run compile
npm run besu:deploy-vcem
npm run audit:verify-bytecode
```

Audit verification:

```bash
npm run audit:verify -- --mode full \
  --rpc=http://127.0.0.1:8545 \
  --registry=<VCEMRegistry> \
  --consent=<VCEMConsent> \
  --audit=<VCEMAudit>

npm run audit:verify -- --mode sample \
  --sample-size 100 \
  --seed 42 \
  --rpc=http://127.0.0.1:8545 \
  --registry=<VCEMRegistry> \
  --consent=<VCEMConsent> \
  --audit=<VCEMAudit>
```

Benchmark workflow:

```bash
npm run benchmark:seed
npm run benchmark:baseline:server
npm run benchmark:baseline:smoke
npm run benchmark:baseline
npm run benchmark:vcem
npm run benchmark:all
npm run benchmark:analyze
```

---

## 18. Release and archival declaration

The authors declare that:

- the declared software version date is 30 June 2026;
- the public Git history records VCEM implementation and release-packaging commits from 2 to 6 July 2026;
- exact reproduction is anchored to full Git commit identifiers, not the version date alone;
- commit `6077d27a9eca686e5395e8e081bbbf588b824a0b` is the preserved audit-validation deployment used for the on-chain authorization population and related reconstruction evidence;
- commit `a493a2c0f6028e52cee6c09b1fc748c2bc8e14e6` identifies the completed formal 10–200 VU evaluation branch containing the finalized evaluation harness, transaction-path correction, instrumentation, and summary artifacts;
- commit `64f185d2f412c45e439827c21ccb509aa38d9531` integrates the formal-evaluation lineage with the audit-integrity and temporal-semantics revision work;
- the full raw formal 10–200 VU campaign evidence is maintained separately for immutable archival and will be identified by its final archive DOI/version;
- legacy DSA, RSA, and ZKP artifacts are retained for provenance but are not evidence for the VCEM authorization claims;
- no dataset, benchmark run, raw log, numerical result, figure, algorithm, or manuscript text from references [3] or [9] is reported as new evidence;
- shared use of Hyperledger Besu, Solidity, Docker, Hardhat, cryptographic hashing, off-chain storage, and HL7 FHIR is treated as shared technical background;
- all released experimental data and identifiers are synthetic; and
- no production credential, institutional secret, pseudonymization secret, participant key, validator key, or real patient information is intentionally included.

---

## 19. Contact

For questions concerning artifact provenance or reproduction:

**João Carlos Ferreira**  
Corresponding author  
Email: `joam@himolde.no`
