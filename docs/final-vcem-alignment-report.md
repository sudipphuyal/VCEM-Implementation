# Final VCEM Alignment Report

## Implemented and Tested

- VCEM contracts preserve the baseline invariant: `VCEMAudit.authorizeAndLogAccess` validates the active consent state in the same transaction that records an authorized access event.
- `VCEMConsent` appends immutable consent versions for create, update, and revoke operations.
- Consent hashes are recomputable from canonical ABI-encoded SHA-256 inputs, and actor roots are derived from sorted pseudonymous actor IDs.
- `VCEMRegistry` tracks pseudonymous actor identities, roles, active/revoked state, and wallet mappings used by access authorization.
- The authoritative VCEM matrix contains exactly 60 policy permutations and 120 nominal/adversarial outcomes.
- The controlled ordering test records block number, transaction index, and log index so access is checked against the consent state active at transaction position.
- The audit verifier reconstructs lifecycle and access evidence from RPC logs, receipts, transaction calldata, block metadata, ABIs, and local artifacts.
- The authenticated TypeScript API/data-proxy path verifies wallet sessions, registry identity, on-chain `AccessAuthorized` events, configured chain ID, configured audit contract address, one-time release state, and encrypted artifact integrity.
- FHIR fixtures execute real VCEM create/update/revoke calls and generate AuditEvent-shaped output from real access events.
- Security controls now include ignored `.env`, placeholder `.env.example`, secret scanning, Solhint configuration, coverage, gas reporting, property tests, dependency audit gate, and Besu config validation.
- Legacy ZKP tests are isolated behind `npm run test:legacy:zkp`; they skip proof-dependent checks when local generated artifacts are absent or mismatched and are not part of baseline VCEM evidence.

## Implemented but Not Experimentally Executed Here

- The five-node local Besu topology is implemented under `infrastructure/besu/` with four IBFT 2.0 validators, one non-validator RPC node, persistent volumes, static peers, metrics, and deployment-manifest generation. Full runtime validation requires Docker.
- Benchmark tooling is implemented for 10, 25, 50, 75, and 100 users, five runs per level, 60-second warm-up, 300-second measurement, deterministic fixture setup, cleanup/reset hooks, VCEM k6 workload, PostgreSQL RBAC/RLS baseline, resource sampling, raw JSON/CSV, summary statistics, confidence intervals, charts metadata, and Markdown reports.
- Benchmark metadata can record `not executed` when prerequisites such as `k6`, PostgreSQL, Besu, or API URLs are missing. No performance claim is supported until successful raw runs exist.
- Slither is wired through `npm run slither` and GitHub Actions, but local execution requires the Slither binary.
- Coverage and gas reporting are configured; final command results should be consulted for local pass/fail status.

## Not Implemented

- Legal GDPR compliance analysis or certification.
- Production clinical deployment hardening.
- Live FHIR-server integration or SMART-on-FHIR authorization.
- Production KMS/HSM integration; only the interface and development key provider are present.
- A complete VCEM ZKP authorization circuit proving active consent, actor inclusion, purpose/scope authorization, and replay-safe nullifiers.
- Production-grade key recovery, participant wallet recovery, or institutional identity-governance workflows.

## Paper Claims Requiring Manuscript Revision

- Replace broad compliance claims with the narrower implementation claim: independently verifiable per-access consent-state binding.
- Treat FHIR as fixture-based R4 alignment, not live integration.
- Treat ZKP as an experimental extension, not evidence of VCEM authorization correctness.
- Remove production clinical deployment language unless supported by deployment, operational, privacy, and security evidence outside this prototype.
- Do not report blockchain, API, proxy, Besu, baseline, or ZKP performance figures unless produced by successful benchmark runs and stored raw artifacts.

## Security and Dependency Status

- `.env` is ignored and untracked; `.env.example` contains placeholders only.
- Secret scanning is available through `npm run secret:scan` and CI also invokes Gitleaks.
- Dependency audit is intentionally not ignored in CI. Current high/critical transitive findings are tracked in `docs/dependency-risk-register.md`.
- `npm audit fix` was attempted without `--force`; it failed on Hardhat peer-dependency conflicts, so no unsafe forced dependency migration was applied.

## Evidence Commands

```bash
npm run lint
HARDHAT_DISABLE_DOWNLOADS=true npm run compile
npm test
npm run test:vcem:matrix
npm run test:audit-verifier
npm run test:fhir
npm run test:property
npm run test:legacy:zkp
npm run secret:scan
npm run solhint
npm run coverage
npm run gas
npm run besu:config:validate
npm run security:audit
```

## Final Check Results

Run date: 2026-07-03.

| Command | Result | Summary |
| --- | --- | --- |
| `npm run secret:scan` | Pass | No obvious committed secrets detected in tracked files. |
| `.env` tracking check | Pass | `.env` is ignored by `.gitignore` and not tracked. |
| `npm run solhint` | Pass with warnings | Exits 0; warnings are mostly NatSpec/gas-style findings across retained legacy and VCEM contracts. |
| `npm run besu:config:validate` | Pass | Besu config validation passed. |
| `npm run lint` | Pass | TypeScript typecheck passes. |
| `HARDHAT_DISABLE_DOWNLOADS=true npm run compile` | Pass | Hardhat reports nothing to compile and no compiler download. |
| `npm run test:property` | Pass | 2 property tests passing. |
| `npm test` | Pass | 85 passing. |
| `npm run test:vcem:matrix` | Pass | 2 passing; 60 cases and 120 outcomes. |
| `npm run test:audit-verifier` | Pass | 17 passing. |
| `npm run test:fhir` | Pass | 6 passing. |
| `npm run test:legacy:zkp` | Pass with pending skips | 0 passing, 4 pending because local proof artifacts are stale/mismatched with the verifier. |
| `npm run coverage` | Pass | 87 passing, 4 pending; overall statement coverage 77.66%. |
| `npm run gas` | Pass | 6 VCEM tests passing with gas report generated. |
| `npm run security:audit` | Fail | 54 vulnerabilities: 19 low, 21 moderate, 11 high, 3 critical. |
| `npm run slither` | Not executed locally | Fails with `slither: command not found`; CI uses the Slither action. |
