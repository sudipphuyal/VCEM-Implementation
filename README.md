# Verifiable Consent Enforcement Model (VCEM)

This repository is an expanded implementation of the original blockchain and ZKP prototype for the research direction:

> Blockchain-Based System for Secure and Auditable Health Data Sharing in Digital Clinical Research: Implementation and Experimental Validation.

The implemented and tested VCEM claim is narrower and more precise:

> Independently verifiable per-access consent-state binding.

That means each authorized data-access event is cryptographically linked to the exact active consent state that authorized it at the time of access, and an independent verifier can reconstruct that binding from blockchain evidence.

This repository does not claim legal GDPR compliance, production clinical deployment, live FHIR-server integration, or benchmark performance results unless those workflows are actually executed and their evidence artifacts are present.

## What Is Implemented

### On-chain VCEM contracts

- `contracts/vcem/VCEMRegistry.sol`
  - pseudonymous actor IDs;
  - wallet-to-actor mapping;
  - participant, researcher, data custodian, policy gateway, and auditor roles;
  - role revocation, actor revocation, wallet update, and pause controls.
- `contracts/vcem/VCEMConsent.sol`
  - participant-controlled consent creation, update, and revocation;
  - immutable version history;
  - canonical SHA-256 consent-state chaining;
  - purpose mask, scope hash, actor set, actor root, and ZK commitment metadata;
  - version-specific actor membership checks.
- `contracts/vcem/VCEMAudit.sol`
  - EIP-712 access-request verification;
  - request expiry checks;
  - replay protection;
  - active consent lookup in the same transaction;
  - actor, role, purpose, scope, data-hash, expected-consent-hash, and signature checks;
  - `AccessAuthorized` events that store the exact consent hash and version used for authorization.

Legacy DSA/RSA/resource-certification contracts remain for compatibility and provenance. They are not used as evidence for the VCEM claims.

### Off-chain services

- `services/auth/`
  - wallet nonce challenge;
  - signature verification;
  - registry-backed requestor identity resolution;
  - short-lived sessions;
  - session revocation.
- `services/api/`
  - TypeScript API flow for authentication, access authorization, and release;
  - PostgreSQL migration in `services/api/migrations/001_vcem_api.sql`.
- `services/data-proxy/`
  - policy-enforcing data proxy;
  - provider-fetched transaction receipts;
  - fixed chain ID and fixed `VCEMAudit` address checks;
  - event decoding and one-time release ledger.
- `services/storage/`
  - encrypted fixture artifact storage;
  - direct storage access denial in tests.
- `services/encryption/`
  - AES-256-GCM fixture encryption;
  - per-participant development key provider;
  - KMS/HSM interface for future production integration;
  - cryptographic erasure by key destruction.
- `services/pseudonymization/`
  - HMAC-SHA-256 pseudonymous ID derivation.
- `services/fhir-adapter/`
  - anonymized FHIR R4 Consent fixture mapping;
  - real VCEM lifecycle call execution in integration tests;
  - FHIR AuditEvent-shaped output from real `AccessAuthorized` events.

### Independent verification

- `scripts/auditVerify.ts`
  - reconstructs registry, consent, data-hash, access, and denial evidence from chain logs;
  - sorts by `blockNumber`, `transactionIndex`, and `logIndex`;
  - recomputes consent hashes and actor roots;
  - validates access events against active consent state at event position;
  - decodes `authorizeAndLogAccess` calldata;
  - reconstructs EIP-712 domain/message and recovers the signer.
- `scripts/verifyDeployedBytecode.ts`
  - compares deployed runtime bytecode from RPC against local compiled artifacts;
  - normalizes immutable and linked-library references where applicable.

### Validation and evidence

- `test/VCEM.ts`
  - core VCEM unit tests.
- `test/VCEMMatrix.ts`
  - authoritative 60-case / 120-outcome VCEM correctness matrix.
- `test/AuditVerifier.ts`
  - audit-verifier tamper-detection tests.
- `test/DataProxy.ts` and `test/ApiDataProxy.ts`
  - authenticated one-time release and data-proxy enforcement tests.
- `test/FHIRAdapter.ts`
  - FHIR fixture-to-contract lifecycle tests.
- `test/VCEMProperty.ts`
  - property tests for canonical consent hashing behavior.

Generated matrix evidence is written to:

- `artifacts/vcem-matrix/vcem-correctness-matrix.json`
- `artifacts/vcem-matrix/vcem-correctness-matrix.csv`
- `artifacts/vcem-matrix/vcem-concurrency-ordering.json`
- `artifacts/vcem-matrix/vcem-concurrency-ordering.csv`

## Repository Layout

```text
contracts/
  vcem/                         VCEM registry, consent, audit, types, libraries, interfaces
  DSA/, RSA/                    retained legacy agreement contracts
  ABVerifier.sol                retained generated Groth16 verifier
  DataSharingAgreementZKP.sol   retained legacy experimental ZKP contract

services/
  api/                          authenticated API flow and PostgreSQL migration
  auth/                         wallet challenge/session and registry identity helpers
  data-proxy/                   secure proxy, delivery ledger, receipt/event checks
  encryption/                   AES-256-GCM and key-provider abstraction
  fhir-adapter/                 anonymized FHIR R4 fixture mapping and AuditEvent output
  pseudonymization/             HMAC-SHA-256 pseudonymous ID helper
  storage/                      encrypted artifact store

scripts/
  auditVerify.ts                independent audit verifier
  verifyDeployedBytecode.ts     deployed bytecode verifier
  writeDeploymentManifest.ts    deployment manifest writer
  secretScan.ts                 local secret scanner

infrastructure/besu/
  docker-compose.yml            five-node local Besu topology
  genesis.json.template         IBFT 2.0 genesis template
  scripts/                      network generation, deploy, status, verification

benchmarks/
  k6/                           VCEM and baseline k6 workloads
  baseline/                     PostgreSQL RBAC/RLS baseline
  scripts/                      seed, run, analyze benchmark commands
  raw/                          raw benchmark metadata and outputs
  analysis/                     generated summaries
  reports/                      generated Markdown report

docs/                           detailed supporting documentation
test/                           unit, integration, matrix, verifier, FHIR, property tests
```

## Prerequisites

- Node.js compatible with the installed Hardhat toolchain.
- npm.
- Docker and Docker Compose for local Besu execution.
- PostgreSQL 15 for API/database and baseline benchmark execution.
- k6 for benchmark execution.
- Slither binary for local Slither execution.

The repository pins npm dependencies in `package-lock.json`. Use `npm ci` for reproducibility.

## Environment Setup

Create a local environment file from placeholders:

```bash
cp .env.example .env
```

Fill only local values in `.env`. Do not commit `.env`; it is ignored by Git.

Important environment variables include:

- `BESU_NETWORK_URL`
- `LOCAL_RPC_URL`
- `DATABASE_URL`
- `VCEM_REGISTRY_ADDRESS`
- `VCEM_CONSENT_ADDRESS`
- `VCEM_AUDIT_ADDRESS`
- `VCEM_CHAIN_ID`
- `VCEM_REQUIRED_CONFIRMATIONS`
- `VCEM_PSEUDONYMIZATION_SECRET`
- `VCEM_KEYSTORE_PATH`
- `VCEM_ARTIFACT_STORE`
- `VCEM_API_PORT`

Never commit private keys, mnemonics, RPC keys, API keys, database credentials, pseudonymization secrets, validator keys, generated Besu keys, or participant encryption keys.

## Install and Compile

```bash
npm ci
HARDHAT_DISABLE_DOWNLOADS=true npm run compile
```

VCEM contracts compile with Solidity 0.8.20. Retained legacy contracts use Solidity 0.8.27 where required. Hardhat is configured to resolve local `soljson` compiler packages instead of downloading compilers at runtime.

## Reproduce All Outcomes and Test Reports

This is the recommended end-to-end order for reproducing the implementation evidence. Run from the repository root.

Create a local folder for terminal logs:

```bash
mkdir -p reports/execution-logs
```

### Step 1: Install Dependencies

```bash
npm ci 2>&1 | tee reports/execution-logs/01-npm-ci.log
```

Expected result:

- dependencies install from `package-lock.json`;
- no source files should be edited by this command.

### Step 2: Offline Solidity Compile

```bash
HARDHAT_DISABLE_DOWNLOADS=true npm run compile 2>&1 | tee reports/execution-logs/02-offline-compile.log
```

Expected result:

- Hardhat compiles without downloading Solidity compilers;
- VCEM contracts use Solidity 0.8.20;
- retained legacy contracts use the pinned local 0.8.27 compiler where required.

Primary evidence:

- `artifacts/contracts/vcem/VCEMRegistry.sol/VCEMRegistry.json`
- `artifacts/contracts/vcem/VCEMConsent.sol/VCEMConsent.json`
- `artifacts/contracts/vcem/VCEMAudit.sol/VCEMAudit.json`
- `reports/execution-logs/02-offline-compile.log`

### Step 3: Run the Default Supported Test Suite

```bash
npm test 2>&1 | tee reports/execution-logs/03-npm-test.log
```

Expected result from the last recorded local run:

- 85 passing tests.

This suite covers:

- retained legacy non-ZKP contracts;
- authenticated API/data-proxy tests;
- FHIR adapter tests;
- VCEM unit tests;
- VCEM matrix tests;
- audit-verifier tests.

Primary evidence:

- `reports/execution-logs/03-npm-test.log`

### Step 4: Run Focused VCEM Evidence Tests

```bash
npm run test:vcem 2>&1 | tee reports/execution-logs/04-vcem-unit.log
npm run test:vcem:matrix 2>&1 | tee reports/execution-logs/05-vcem-matrix.log
npm run test:audit-verifier 2>&1 | tee reports/execution-logs/06-audit-verifier.log
npm run test:fhir 2>&1 | tee reports/execution-logs/07-fhir.log
npm run test:api 2>&1 | tee reports/execution-logs/08-api-proxy.log
npm run test:property 2>&1 | tee reports/execution-logs/09-property.log
```

Expected result from the last recorded local run:

- `npm run test:vcem:matrix`: 2 passing;
- `npm run test:audit-verifier`: 17 passing;
- `npm run test:fhir`: 6 passing;
- `npm run test:property`: 2 passing.

Generated VCEM matrix evidence:

- `artifacts/vcem-matrix/vcem-correctness-matrix.json`
- `artifacts/vcem-matrix/vcem-correctness-matrix.csv`
- `artifacts/vcem-matrix/vcem-concurrency-ordering.json`
- `artifacts/vcem-matrix/vcem-concurrency-ordering.csv`

The matrix files are the main machine-readable evidence for the 60 policy permutations, 120 outcomes, exact denial reasons, request IDs, transaction hashes, block numbers, transaction indexes, log indexes, consent hashes, and pass/fail status.

### Step 5: Run Legacy Experimental ZKP Tests

```bash
npm run test:legacy:zkp 2>&1 | tee reports/execution-logs/10-legacy-zkp.log
```

Expected result from the last recorded local run:

- command exits successfully;
- proof-dependent checks may be pending/skipped if local proof artifacts are absent or mismatched with the generated verifier.

Important interpretation:

- this command is not VCEM authorization proof evidence;
- do not describe it as formal verification or a complete ZKP authorization proof.

### Step 6: Run Security and Static-Analysis Checks

```bash
npm run secret:scan 2>&1 | tee reports/execution-logs/11-secret-scan.log
npm run solhint 2>&1 | tee reports/execution-logs/12-solhint.log
npm run security:audit 2>&1 | tee reports/execution-logs/13-npm-audit.log
npm run besu:config:validate 2>&1 | tee reports/execution-logs/14-besu-config-validate.log
```

Expected result from the last recorded local run:

- `npm run secret:scan`: pass;
- `npm run solhint`: pass with warnings;
- `npm run security:audit`: fails because unresolved high/critical dependency findings remain;
- `npm run besu:config:validate`: pass.

Important interpretation:

- Solhint is executed static analysis.
- npm audit is executed dependency security analysis.
- The dependency-audit failure is an unresolved risk, not a clean security sign-off.
- Slither is configured, but local Slither execution requires installing the Slither binary.

Optional Slither command:

```bash
npm run slither 2>&1 | tee reports/execution-logs/15-slither.log
```

Expected behavior without local Slither installed:

- fails with `slither: command not found`.

If Slither is installed, keep `reports/execution-logs/15-slither.log` as the static-analysis report.

### Step 7: Run Coverage and Gas Reports

```bash
npm run coverage 2>&1 | tee reports/execution-logs/16-coverage.log
npm run gas 2>&1 | tee reports/execution-logs/17-gas.log
```

Expected result from the last recorded local run:

- `npm run coverage`: pass, 87 passing / 4 pending, 77.66% statement coverage;
- `npm run gas`: pass, 6 VCEM tests passing with gas report.

Generated coverage evidence:

- `coverage/index.html`
- `coverage/lcov.info`
- `coverage/coverage-final.json`
- `coverage.json`
- `reports/execution-logs/16-coverage.log`

Generated gas evidence:

- `reports/execution-logs/17-gas.log`

### Step 8: Optional Local Besu Network and Deployment

Docker is required for this section.

```bash
npm run besu:generate-network 2>&1 | tee reports/execution-logs/18-besu-generate.log
npm run besu:up 2>&1 | tee reports/execution-logs/19-besu-up.log
npm run besu:status 2>&1 | tee reports/execution-logs/20-besu-status.log
npm run besu:verify 2>&1 | tee reports/execution-logs/21-besu-verify.log
HARDHAT_DISABLE_DOWNLOADS=true npm run compile 2>&1 | tee reports/execution-logs/22-besu-compile.log
npm run besu:deploy-vcem 2>&1 | tee reports/execution-logs/23-besu-deploy-vcem.log
npm run audit:verify-bytecode 2>&1 | tee reports/execution-logs/24-bytecode-verify.log
```

Generated Besu/deployment evidence:

- `infrastructure/besu/generated/genesis.json`
- `infrastructure/besu/generated/static-nodes.json`
- `infrastructure/besu/generated/network-manifest.json`
- `deployments/vcem-manifest.json`
- `reports/execution-logs/21-besu-verify.log`
- `reports/execution-logs/23-besu-deploy-vcem.log`
- `reports/execution-logs/24-bytecode-verify.log`

Stop the local network:

```bash
npm run besu:down
```

Remove generated local keys, containers, and volumes:

```bash
npm run besu:clean
```

### Step 9: Optional Independent Audit Verification Against Deployed Contracts

Run this after deploying VCEM contracts to a local Besu network or another RPC endpoint.

```bash
npm run audit:verify -- --mode full \
  --rpc=http://127.0.0.1:8545 \
  --registry=<VCEMRegistry> \
  --consent=<VCEMConsent> \
  --audit=<VCEMAudit> \
  2>&1 | tee reports/execution-logs/25-audit-verify-full.log
```

Sampled mode:

```bash
npm run audit:verify -- --mode sample --sample-size 100 --seed 42 \
  --rpc=http://127.0.0.1:8545 \
  --registry=<VCEMRegistry> \
  --consent=<VCEMConsent> \
  --audit=<VCEMAudit> \
  2>&1 | tee reports/execution-logs/26-audit-verify-sample.log
```

Generated audit-verifier evidence:

- `evidence/audit/audit-report.json`
- `evidence/audit/audit-report.csv`
- `reports/execution-logs/25-audit-verify-full.log`
- `reports/execution-logs/26-audit-verify-sample.log`

### Step 10: Optional Benchmarks

Benchmarks require k6, PostgreSQL, the API/proxy services, and for VCEM benchmark runs a deployed VCEM environment with signed fixtures.

```bash
npm run benchmark:seed 2>&1 | tee reports/execution-logs/27-benchmark-seed.log
npm run benchmark:baseline 2>&1 | tee reports/execution-logs/28-benchmark-baseline.log
npm run benchmark:vcem 2>&1 | tee reports/execution-logs/29-benchmark-vcem.log
npm run benchmark:analyze 2>&1 | tee reports/execution-logs/30-benchmark-analyze.log
```

Generated benchmark evidence:

- `benchmarks/raw/fixtures/benchmark-fixtures.json`
- `benchmarks/raw/baseline/<users>u/run-<n>/metadata.json`
- `benchmarks/raw/vcem/<users>u/run-<n>/metadata.json`
- `benchmarks/analysis/summary.json`
- `benchmarks/analysis/summary.csv`
- `benchmarks/reports/benchmark-report.md`

Interpretation rule:

- use benchmark results only when the relevant metadata says `status: executed`;
- do not cite `not executed` benchmark metadata as performance evidence.

### Step 11: Paper/Reviewer Report

A Word report summarizing smart contract validation, static analysis, and formal-verification status is available at:

```text
reports/reviewer2-smart-contract-verification-report.docx
```

It states that:

- Solhint static analysis was executed;
- Slither is configured but needs a local Slither binary for local execution;
- no completed formal verification proof currently exists;
- bytecode verification tooling exists but requires a live deployment manifest and RPC run for deployed evidence.

### What to Include in the Paper

Safe claims:

- offline reproducible Solidity compile was executed;
- VCEM unit/integration tests were executed;
- the 60-case/120-outcome VCEM matrix was executed;
- audit-verifier tamper-detection tests were executed;
- fixture-based FHIR lifecycle tests were executed;
- Solhint static analysis was executed;
- coverage and gas reports were executed;
- dependency audit was executed and currently reports unresolved findings.

Do not claim unless you execute and archive evidence:

- legal GDPR compliance;
- production clinical deployment;
- live FHIR-server integration;
- completed formal verification;
- completed Slither local findings;
- benchmark performance results;
- live deployed bytecode verification;
- complete ZKP-based VCEM authorization proof.

## Core VCEM Flow

1. Register pseudonymous participant, researcher, custodian, gateway, and auditor identities in `VCEMRegistry`.
2. Participant creates a consent policy in `VCEMConsent`.
3. Participant may later update or revoke consent; every change appends a new immutable version.
4. Data custodian registers an off-chain artifact integrity hash in `VCEMAudit`.
5. Researcher signs an EIP-712 access request.
6. API validates request shape but does not decide authorization.
7. `VCEMAudit.authorizeAndLogAccess` validates:
   - request expiry;
   - replay status;
   - EIP-712 signature;
   - active requestor identity and role;
   - current active consent state;
   - expected consent hash;
   - actor authorization;
   - purpose authorization;
   - scope authorization;
   - registered data hash and participant binding.
8. On success, `VCEMAudit` emits `AccessAuthorized` with the consent version, consent hash, actor root, data hash, request ID, and requestor ID.
9. The data proxy fetches the receipt directly from RPC, validates the event, checks the authenticated session requestor, enforces one-time release, decrypts the approved artifact, and records a release ledger entry.
10. Independent audit verification can later reconstruct the consent/access binding from chain evidence.

## Authentication and API

The implemented API flow is wallet-authenticated and session-bound.

Endpoints:

- `POST /auth/challenge`
- `POST /auth/session`
- `POST /auth/revoke`
- `POST /access/authorize`
- `POST /data/release`

Authentication flow:

1. `POST /auth/challenge` receives a wallet address and creates a nonce challenge with expiry.
2. The researcher signs the challenge with the registered wallet.
3. `POST /auth/session` verifies the signature, resolves the wallet through `VCEMRegistry`, rejects inactive/revoked/role-mismatched identities, and creates a short-lived PostgreSQL-backed session.
4. `POST /auth/revoke` revokes a session token.
5. A valid session is required for authorization relay and data release, but it is not enough to release data.

Database migration:

```bash
psql "$DATABASE_URL" -f services/api/migrations/001_vcem_api.sql
```

Direct storage access is denied. A transaction hash or receipt is not treated as a reusable bearer token.

## Secure Data Proxy

The secure proxy path is `services/data-proxy/policyProxy.ts`.

The proxy:

- fetches receipts directly from the configured RPC provider;
- rejects caller-supplied receipt objects;
- enforces fixed chain ID;
- enforces fixed `VCEMAudit` contract address;
- decodes and validates `AccessAuthorized`;
- checks participant ID, requestor ID, data hash, scope, purpose, request ID, consent version, consent hash, and actor root;
- checks that the authenticated session wallet maps to the authorized requestor;
- denies duplicate release by default through the PostgreSQL delivery ledger;
- avoids plaintext clinical data in logs and ledger rows.

`services/data-proxy/proxy.ts` is the old insecure demonstration helper. It accepted transaction hash/data hash inputs directly and is not production-facing.

## Privacy, Pseudonymization, and Erasure

VCEM keeps sensitive health data off-chain.

On-chain records are limited to pseudonymous identifiers, hashes, timestamps, policy metadata, consent references, data-hash registrations, and audit references.

Off-chain fixture artifacts use AES-256-GCM encryption. Each participant can have a distinct key. Destroying the participant key provides cryptographic erasure because the ciphertext remains unreadable even if retained. Ciphertext deletion is supported separately by the artifact store.

Pseudonymization uses HMAC-SHA-256 with an institution-controlled off-chain secret. That secret must never be committed, printed, or stored on-chain.

## FHIR R4 Fixture Support

FHIR support is fixture-based and anonymized. It is not live FHIR-server integration.

Supported mappings:

| FHIR field | VCEM mapping |
| --- | --- |
| `Consent.patient` | Pseudonymous `participantId` derived off-chain |
| `Consent.performer` / supported `provision.actor` | Authorized actor pseudonymous IDs |
| `Consent.provision.purpose` | Canonical purpose mask |
| `Consent.provision.data` / supported subject references | Canonical data hash |
| `Consent.provision.period` | Scope/policy metadata where supported |
| `Consent.dateTime` | Fixture consent timestamp metadata |
| `Consent.status` | `active -> createConsent`, `draft -> updateConsent`, `inactive/rejected -> revokeConsent` |
| `AccessAuthorized` | FHIR AuditEvent-shaped output |

Supported nested provisions:

- one level of nested `Consent.provision`;
- permit-only provisions;
- deterministic flattening of purpose, actor, data, and period fields.

Unsupported semantics are rejected with validation errors:

- deny provisions;
- nesting deeper than one level;
- conflicting allow/deny structures;
- raw patient identifiers;
- inline clinical resources;
- identifying free-text data labels;
- multiple policy periods requiring temporal authorization logic.

Run FHIR integration tests:

```bash
npm run test:fhir
```

## VCEM Correctness Matrix

Run:

```bash
npm run test:vcem:matrix
```

The matrix contains exactly:

- 60 policy permutations;
- 120 nominal/adversarial outcomes.

It covers:

- active initial consent;
- modified active consent;
- revoked consent;
- allowed and disallowed purposes;
- malformed purpose;
- invalid scope;
- tampered data hash;
- tampered signature;
- expired request;
- replayed request;
- unauthorized active researcher;
- active role-mismatched actor;
- revoked actor;
- actor removed after update;
- actor added after update;
- stale consent hash;
- stale actor-root state represented through stale consent after actor-set update;
- post-revocation access;
- controlled concurrent access-versus-consent-update ordering.

Concurrency evidence disables automine, submits access/update transactions in deterministic order, mines a controlled block, and records block number, transaction index, and log index.

## Independent Audit Verification

The verifier uses only:

- RPC endpoint;
- deployed VCEM contract addresses;
- ABI files;
- transaction calldata;
- receipts;
- logs;
- block metadata;
- local compiled artifacts for bytecode comparison.

Full verification:

```bash
npm run audit:verify -- --mode full --rpc=http://127.0.0.1:8545 --registry=<VCEMRegistry> --consent=<VCEMConsent> --audit=<VCEMAudit>
```

Sampled verification:

```bash
npm run audit:verify -- --mode sample --sample-size 100 --seed 42 --rpc=http://127.0.0.1:8545 --registry=<VCEMRegistry> --consent=<VCEMConsent> --audit=<VCEMAudit>
```

Bytecode verification:

```bash
npm run audit:verify-bytecode -- --rpc=http://127.0.0.1:8545 --manifest=deployments/vcem-manifest.json
```

Reports are written under `evidence/audit/`. Sample mode selects exactly 100 eligible access events when at least 100 exist; otherwise it verifies all eligible events and reports that fewer were available.

## Local Besu Network

The local reproducible network is under `infrastructure/besu/`.

Topology:

- 4 IBFT 2.0 validators;
- 1 non-validator RPC node;
- 2-second block period;
- Docker private network;
- persistent volumes;
- static peers;
- localhost-bound RPC;
- metrics endpoints.

Generate and run:

```bash
npm run besu:generate-network
npm run besu:up
npm run besu:status
npm run besu:verify
```

Deploy VCEM contracts:

```bash
HARDHAT_DISABLE_DOWNLOADS=true npm run compile
npm run besu:deploy-vcem
npm run audit:verify-bytecode
```

Stop or clean:

```bash
npm run besu:down
npm run besu:clean
```

Generated keys and local network material are ignored by Git:

- `infrastructure/besu/generated/`
- `infrastructure/besu/validators/`
- `infrastructure/besu/rpc/`

Deployment manifest:

```text
deployments/vcem-manifest.json
```

The manifest contains chain ID, validator addresses, topology, contract addresses, deployment transaction hashes, ABI version, runtime bytecode hashes, Git commit, and timestamp.

## Benchmarks

Benchmark tooling exists for:

- authenticated VCEM API and secure data-proxy path;
- PostgreSQL 15 RBAC/RLS baseline with equivalent participant, researcher, role, purpose, scope, authentication, and encrypted-artifact delivery logic.

Commands:

```bash
npm run benchmark:seed
npm run benchmark:baseline
npm run benchmark:vcem
npm run benchmark:all
npm run benchmark:analyze
```

Workload levels:

- 10 users;
- 25 users;
- 50 users;
- 75 users;
- 100 users.

Each level has:

- 60-second warm-up;
- 300-second measurement window;
- five independent runs;
- deterministic fixture setup;
- cleanup/reset hooks;
- separate raw output per run.

Measured metrics include:

- blockchain transaction confirmation time;
- end-to-end application latency;
- p50 and p95 latency;
- throughput/TPS;
- error rate;
- proxy release/denial rate;
- API CPU/memory;
- CPU/memory for each Besu node;
- RPC failure rate;
- baseline latency and throughput.

Artifacts:

- `benchmarks/raw/**/metadata.json`
- `benchmarks/raw/**/k6-summary.json`
- `benchmarks/raw/**/resources.csv`
- `benchmarks/analysis/summary.json`
- `benchmarks/analysis/summary.csv`
- `benchmarks/reports/benchmark-report.md`

Benchmark reports must be treated as evidence only when metadata says `status: executed`. Do not use `not executed` metadata as performance evidence.

## Testing

Run the default supported test suite:

```bash
npm test
```

Run focused suites:

```bash
npm run test:vcem
npm run test:vcem:matrix
npm run test:audit-verifier
npm run test:api
npm run test:fhir
npm run test:property
npm run test:legacy:zkp
```

`npm run test:legacy:zkp` is explicit and experimental. It may skip proof-dependent checks when local proof artifacts are absent or mismatched with the generated verifier. It is not evidence that VCEM authorization has been proven in zero knowledge.

## Security and Quality Commands

```bash
npm run lint
npm run solhint
npm run secret:scan
npm run security:audit
npm run coverage
npm run gas
npm run slither
npm run besu:config:validate
```

Current behavior:

- `npm run lint` runs TypeScript type checking.
- `npm run solhint` runs Solidity linting and may emit warnings.
- `npm run secret:scan` scans tracked and unignored files for obvious secret patterns without printing secret values.
- `npm run security:audit` is intentionally a release gate and currently fails due unresolved high/critical transitive dependency findings.
- `npm run coverage` generates Solidity coverage reports under `coverage/` and `coverage.json`.
- `npm run gas` runs the VCEM gas report.
- `npm run slither` requires Slither to be installed locally.
- `npm run besu:config:validate` checks local Besu configuration.

## CI

GitHub Actions runs:

- secret scan;
- dependency audit;
- TypeScript lint;
- Solhint;
- offline Solidity compile;
- full test suite;
- VCEM matrix;
- audit-verifier tests;
- FHIR tests;
- property tests;
- legacy ZKP command;
- coverage;
- gas report;
- Besu config validation;
- Slither action;
- Gitleaks.

Dependency-audit failure is not silently ignored.

## ZKP Status

Legacy Circom/snarkjs assets are retained:

- `circuits/PatientIdProof.circom`
- `circuits/DsaAgreementProof.circom`
- `contracts/ABVerifier.sol`
- `contracts/DataSharingAgreementZKP.sol`

They are experimental and do not prove VCEM authorization semantics.

A complete VCEM ZKP extension would still need to prove:

- active consent commitment existence;
- requestor authorization through Merkle inclusion or equivalent;
- purpose permission;
- scope permission;
- request nullifier linkage;
- replay resistance;
- linkage to the active `VCEMConsent` version.

ZKP proof-generation time is not part of baseline VCEM benchmark claims.

## Claim to Evidence Summary

| Claim | Evidence |
| --- | --- |
| Sensitive data remain off-chain in VCEM path | `contracts/vcem/*`, `services/storage/*`, `services/encryption/*`, `test/DataProxy.ts`, `test/ApiDataProxy.ts` |
| Consent is dynamic, versioned, and revocable | `VCEMConsent.sol`, `test/VCEM.ts`, `test/VCEMMatrix.ts` |
| Access is bound to exact active consent state | `VCEMAudit.sol`, `test/VCEM.ts`, matrix artifacts |
| Independent verification from chain evidence | `scripts/auditVerify.ts`, `test/AuditVerifier.ts` |
| Authenticated one-time release | `services/auth/*`, `services/data-proxy/*`, `test/ApiDataProxy.ts` |
| FHIR fixture lifecycle execution | `services/fhir-adapter/*`, `test/FHIRAdapter.ts` |
| Besu reproducibility | `infrastructure/besu/*`, `npm run besu:config:validate`, deployment manifest when generated |
| Benchmark methodology | `benchmarks/*`, benchmark raw/analysis/report artifacts when executed |
| ZKP authorization proof | Not implemented; experimental only |

## Last Recorded Local Check Results

Recorded on 2026-07-03:

| Command | Result |
| --- | --- |
| `npm run secret:scan` | Pass |
| `.env` tracking check | Pass |
| `npm run solhint` | Pass with warnings |
| `npm run besu:config:validate` | Pass |
| `npm run lint` | Pass |
| `HARDHAT_DISABLE_DOWNLOADS=true npm run compile` | Pass |
| `npm run test:property` | Pass, 2 passing |
| `npm test` | Pass, 85 passing |
| `npm run test:vcem:matrix` | Pass, 2 passing |
| `npm run test:audit-verifier` | Pass, 17 passing |
| `npm run test:fhir` | Pass, 6 passing |
| `npm run test:legacy:zkp` | Pass with 4 pending skips |
| `npm run coverage` | Pass, 87 passing / 4 pending, 77.66% statement coverage |
| `npm run gas` | Pass |
| `npm run security:audit` | Fail: 54 vulnerabilities |
| `npm run slither` | Fails locally unless Slither is installed |

## Known Limitations

- No legal GDPR compliance claim.
- No production clinical deployment claim.
- No live FHIR-server or SMART-on-FHIR integration.
- No production KMS/HSM integration; only an interface and development key provider exist.
- No complete VCEM ZKP authorization circuit.
- Benchmark tooling is executable, but performance results require successful raw runs.
- Local Besu execution requires Docker.
- Local Slither execution requires Slither installation.
- Legacy contracts may contain prototype plaintext fields and are excluded from VCEM claims.
- Current dependency audit findings are documented in `docs/dependency-risk-register.md`.

## Useful One-Shot Command Sets

Install, compile, and test:

```bash
npm ci
HARDHAT_DISABLE_DOWNLOADS=true npm run compile
npm test
```

Run all VCEM evidence tests:

```bash
npm run test:vcem
npm run test:vcem:matrix
npm run test:audit-verifier
npm run test:fhir
npm run test:property
```

Run quality checks:

```bash
npm run lint
npm run solhint
npm run secret:scan
npm run coverage
npm run gas
npm run besu:config:validate
```

Run local Besu and deploy:

```bash
npm run besu:generate-network
npm run besu:up
npm run besu:verify
HARDHAT_DISABLE_DOWNLOADS=true npm run compile
npm run besu:deploy-vcem
npm run audit:verify-bytecode
```

Run benchmarks:

```bash
npm run benchmark:seed
npm run benchmark:all
npm run benchmark:analyze
```

## Supporting Documentation

The root README is the primary operating guide. The `docs/` directory contains deeper reference material, including:

- `docs/architecture.md`
- `docs/audit-verification.md`
- `docs/authentication.md`
- `docs/benchmark-methodology.md`
- `docs/besu-deployment.md`
- `docs/claim-to-evidence.md`
- `docs/data-proxy-security.md`
- `docs/fhir-mapping.md`
- `docs/privacy-and-erasure.md`
- `docs/security-fixes.md`
- `docs/zkp-extension.md`
