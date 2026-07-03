# Remediation Baseline

## Baseline Commands

Run date: 2026-07-03.

| Command | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Pass | TypeScript typecheck passed. |
| `npm run compile` | Pass | Hardhat warned Node.js `v23.11.0` is unsupported. |
| `npm run test:vcem` | Pass | 5 VCEM tests passing; generated 60-row evidence files. |
| `npm test` | Fail | 49 passing, 3 failing legacy ZKP tests. |
| `npm run slither` | Fail | `slither` command is not installed. |
| `npm audit --audit-level=low` | Fail with findings | 59 vulnerabilities: 19 low, 24 moderate, 12 high, 4 critical. |

## Failing Tests

- `test/ABVerifier.test.ts`: checked-in proof returns `false`, but the test expects `true`.
- `test/DataSharingAgreementZKP.test.ts`: `createDsaWithProof` rejects the checked-in proof.
- `test/DataSharingAgreementZKP.test.ts`: `acceptDsaWithProof` rejects the checked-in proof.

These failures are isolated to legacy experimental Groth16/ZKP artifacts. The baseline VCEM path is green.

## Current VCEM Capabilities

- Pseudonymous registry with participant, researcher, data-custodian, gateway, auditor, and admin roles.
- Versioned consent lifecycle with immutable history.
- Consent-state hash persisted in authorized access events.
- EIP-712 researcher request signatures.
- Request expiry and replay protection.
- Data-hash registration by data custodians.
- Basic encrypted artifact helpers and receipt-checking data proxy.
- Fixture-level FHIR mapper.
- Besu and benchmark scaffolding.

## Gaps Against Target Claim

- `actorsRoot` is externally supplied and not cryptographically derived from the enforced actor list.
- Consent hash does not include lifecycle status or ZKP commitment.
- Purpose model uses purpose indexes rather than one canonical bitmask shared across Solidity and TypeScript.
- `AccessAuthorized` does not yet include consent version and actors root.
- Audit verifier does not recompute actor roots, consent hashes, purpose checks, data-hash bindings, or request signatures.
- Data proxy still treats transaction hashes as reusable proof unless wrapped by additional service logic.
- The matrix currently records 60 outcomes, not the requested 60 cases with nominal/adversarial controls for 120 outcomes.

## Security Weaknesses

- Dependency audit reports vulnerable transitive packages.
- Slither is not installed/configured.
- Legacy DSA/RSA contracts store plaintext strings and delete history.
- Legacy ZKP artifacts are mismatched or stale.
- Besu scaffold contains a template genesis, not a generated working IBFT network.
- FHIR adapter is fixture-level and not schema-validated.

## Infrastructure and Benchmark Limitations

- Besu validator keys and IBFT `extraData` are not generated.
- No deployed VCEM manifest exists from a live Besu run.
- Benchmark harness is not wired to a secure API/data-proxy flow.
- PostgreSQL baseline is a schema sketch, not an executable benchmark service.
- No benchmark results have been run or claimed.

## Legacy Module Handling

| Module | Baseline decision |
| --- | --- |
| `contracts/Registries.sol` | Retain for legacy tests; VCEM uses `VCEMRegistry`. |
| `contracts/DSA/*` | Retain, but isolate from VCEM claims because revocation deletes state. |
| `contracts/RSA/*` | Retain, but isolate from VCEM claims because plaintext metadata appears on-chain. |
| `contracts/DataSharingAgreementZKP.sol` and `ABVerifier.sol` | Retain as experimental legacy ZKP; repair or move to explicit legacy command before CI is considered green. |
| `circuits/*` | Retain as experimental proof assets, not VCEM authorization evidence. |
