# Current State Assessment

## Repository Summary

The repository is an initial Hardhat and Circom prototype for blockchain-backed health data sharing. It contains Solidity contracts for role registries, data/resource sharing agreements, resource certification, ZKP-assisted DSA creation, generated Groth16 verifier code, Circom circuits, Ignition deployment modules, and TypeScript tests.

The current implementation is useful as research-prototype ancestry, but it does not yet implement the VCEM invariant:

> Independently verifiable per-access consent-state binding.

## Existing Solidity Components

| Component | Current responsibility | VCEM relevance |
| --- | --- | --- |
| `contracts/Registries.sol` | Address-based role lists for patients, professionals, applications, organizations, issuers, and authorities. | Partially useful as legacy role-management context, but VCEM requires pseudonymous IDs, lifecycle events, scoped roles, active/revoked states, and signature-aware actor resolution. |
| `contracts/DSA/DataSharingAgreement.sol` | Patient-created DSA between provider and recipient with pending/active state, duration, plaintext shared data, and delete-on-revoke behavior. | Prototype only for VCEM. It models consent-like agreements but deletes history and stores plaintext metadata. |
| `contracts/RSA/ResourcesSharingAgreement.sol` | Resource sharing agreement with recipient/observer support and `authorizeAndLogAccess` event emission. | Partially useful conceptually because it has an access logging flow, but it stores raw emails/resource IDs and does not bind access to immutable active consent state. |
| `contracts/ResourceCertification.sol` | Trusted issuer certifies raw resource IDs for subjects. | Prototype only. VCEM should store hashes/pseudonymous identifiers, not raw resource IDs. |
| `contracts/Utils.sol` | Hashing helpers, ID generation, and string duration parsing. | Retain for legacy tests. VCEM should avoid `abi.encodePacked` for multi-field consent hashes and avoid string duration policy fields. |
| `contracts/DataSharingAgreementZKP.sol` | Uses generated verifier to validate a simple proof before creating/accepting a DSA with commitments. | Experimental legacy ZKP only. It does not prove VCEM authorization semantics. |
| `contracts/ABVerifier.sol` | Generated snarkjs Groth16 verifier for one public signal. | Retain as generated artifact, clearly labelled experimental. |
| `contracts/DSA/DsaEnumerator.sol` and `contracts/RSA/RsaEnumerator.sol` | View pagination/filter helpers for legacy agreements. | Retain for compatibility; pagination/indexing bugs should be documented and covered before use in VCEM. |

## Existing Agreement, Consent, Access, Audit, and Identity Logic

The repository has agreement-style consent prototypes, but no explicit versioned consent lifecycle contract. DSAs and RSAs can be created, accepted, rejected, cancelled, and revoked. However, rejection/cancellation/revocation delete agreement state, which prevents immutable audit reconstruction.

Existing access logic is in `ResourcesSharingAgreement.authorizeAndLogAccess`. It checks active RSA state, expiry, shared resource membership, and recipient/observer access. It emits a `ResourceAccessed` event. It does not:

- verify a researcher-signed EIP-712 request;
- protect against replayed request IDs;
- compare an expected active consent hash;
- persist the active consent-state hash used for authorization;
- use pseudonymous identifiers only;
- prevent plaintext resource IDs, emails, and actor metadata from appearing on-chain.

## Existing ZKP Tooling

Existing ZKP files include:

- `circuits/PatientIdProof.circom`: Poseidon commitment over two parties and a secret.
- `circuits/DsaAgreementProof.circom`: hashes patient, professional, shared data, and duration, but has no public output and no complete VCEM authorization semantics.
- Generated artifacts in `build/`, `*.ptau`, `*.zkey`, `verification_key.json`, `proof*.json`, and `public*.json`.
- `contracts/ABVerifier.sol`: generated verifier.
- `scripts/generateCommitmentA.js` and `scripts/generateCommitmentB.js`.
- Tests for `ABVerifier` and `DataSharingAgreementZKP`.

These assets should be retained as experimental legacy ZKP material. They do not currently support claims about ZKP-based consent authorization, purpose/scope checks, actor inclusion, nullifier replay protection, or active-consent linkage.

## Deployment and Configuration

The repository uses Hardhat with Ignition modules under `ignition/modules/`. The compiler is configured as Solidity `0.8.27`, while the paper target is `0.8.20`. No Besu Docker infrastructure, deployment manifest generator, or bytecode verification script exists yet.

The repository has a tracked `.env`. Its contents were not read during assessment. This must be removed from Git tracking and rotated as potentially exposed.

## APIs, Backend, Databases, and Off-chain Storage

At initial assessment time, no API service, backend, database, data proxy, FHIR adapter, audit verifier, pseudonymization service, or benchmark harness existed in the repository. The current VCEM branch now adds TypeScript modules for pseudonymization, fixture FHIR mapping, audit verification scripts, data-proxy enforcement, Besu scaffolding, and benchmark scaffolding. A production API server and database-backed service remain out of scope.

## Tests and Tooling

Existing tests cover:

- role registry happy/error paths;
- resource certification;
- DSA creation/acceptance/rejection/cancellation;
- RSA creation, observer assignment, revocation cleanup, and pagination;
- generated verifier proof acceptance;
- ZKP DSA creation/acceptance.

Missing tests relative to VCEM:

- versioned consent history preservation;
- consent state hash chaining;
- per-access consent-hash binding;
- EIP-712 request signatures;
- replay/expiry/outdated-consent rejection;
- role revocation effects;
- paused behavior;
- denied event structure;
- audit verifier reconstruction;
- off-chain proxy bypass denial;
- 60-case consent-state matrix evidence.

## Components That Already Support VCEM

- Hardhat project structure and TypeScript tests.
- Existing role vocabulary and registry prototype.
- Existing access-log concept in RSA.
- Existing ZKP proof-generation/verifier artifacts as experimental starting points.
- Existing deployment modules for individual contracts.

## Components That Partially Support VCEM

- `Registries.sol`: role checks exist but need pseudonymous identity lifecycle and auditable events.
- `ResourcesSharingAgreement.sol`: authorization/logging exists but not with VCEM binding or privacy constraints.
- `DataSharingAgreement.sol`: consent-like agreement lifecycle exists but deletes audit history.
- ZKP artifacts: commitment proof exists but not VCEM authorization proof.

## Prototype-only Components

- Plaintext resource certification.
- Plaintext RSA observer email flow.
- String-based durations and resource lists.
- Generated ZKP verifier and current circuits.
- Hardcoded local proof/input files.

## Retain, Extend, Replace, or Deprecate

- Retain existing legacy contracts and tests for backward compatibility.
- Add new `contracts/vcem/` contracts for VCEM rather than rewriting legacy DSA/RSA contracts.
- Mark plaintext/delete-on-revoke legacy flows as not suitable for VCEM, but do not move or remove them.
- Add services, docs, audit verifier, and reproducibility scripts around the new VCEM layer.

## Missing Features Relative to the Paper

- Versioned participant-controlled consent.
- Immutable consent history.
- Consent-state hash chaining with canonical SHA-256 over `abi.encode`.
- Per-access active consent hash persisted in each access event.
- EIP-712 actor request signatures.
- Pseudonymous on-chain identifiers.
- Replay and expiry protection.
- Independent on-chain-log audit verifier.
- Off-chain encrypted artifact proxy.
- FHIR R4 fixture adapter.
- Besu IBFT local network scaffolding.
- Reproducible benchmark harness.

## Security Weaknesses and Technical Debt

- `.env` is tracked.
- Generated proofs/setup files and local inputs are tracked without classification.
- Plaintext patient/resource/email metadata is stored or emitted on-chain in legacy flows.
- Agreements and resource certificates can be deleted, breaking audit reconstruction.
- Role management uses raw addresses and lacks standardized role events.
- No pausing controls.
- No replay protection for access requests.
- No request signature verification for access authorization.
- No static analysis configuration.
- Pagination helpers contain indexing issues in recipient filtered views.
- Hardhat config concatenates Sepolia URL and API key without guarding missing values.
- Solidity compiler version differs from the paper target.

## Unsupported Paper Claims

The current repository does not support claims of:

- legal GDPR compliance;
- production clinical deployment readiness;
- complete FHIR-server integration;
- independently verifiable per-access consent-state binding;
- ZKP-based VCEM authorization semantics;
- measured ZKP or blockchain performance;
- off-chain encrypted data retrieval enforcement;
- Besu IBFT experimental reproduction.

The accurate current claim is: an initial blockchain/ZKP prototype with agreement, registry, resource certification, and simple commitment proof components.
