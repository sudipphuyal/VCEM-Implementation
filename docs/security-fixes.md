# Security Fixes

- Removed `.env` from Git tracking without deleting the local file.
- Added `.env` and local proof/setup outputs to `.gitignore`.
- Added `.env.example` with placeholders only.
- Added pseudonymous VCEM contracts that avoid raw patient IDs, emails, resource labels, and clinical data on-chain.
- Added versioned consent history instead of delete-on-revoke VCEM behavior.
- Added EIP-712 researcher request verification.
- Added request expiry and replay protection.
- Added role and actor revocation controls.
- Added pause controls on registry, consent, and audit contracts.
- Added receipt-based data proxy verification before encrypted artifact release.
- Added secret-rotation documentation.
- Replaced caller-supplied VCEM actor roots with contract-derived actor-set commitments.
- Added versioned actor-list getters for independent audit recomputation.
- Added canonical purpose-bit validation for access requests.
- Isolated mismatched legacy ZKP tests under `npm run test:legacy:zkp` so default VCEM/legacy non-ZKP tests are reproducible and green.
- Fixed historical consent immutability so fields included in old consent hashes are never mutated.
- Added authenticated policy-enforcing data-proxy service with one-time request delivery ledger.
- Added local `solc@0.8.20` for VCEM compiler reproducibility.
- Added `npm run secret:scan` for tracked-file secret scanning.
- Added Solhint, Slither configuration, Solidity coverage, gas reporting, Besu config validation, and property tests.
- Added GitHub Actions jobs for linting, offline compile, full tests, VCEM matrix, audit verifier tests, FHIR tests, coverage, gas report, dependency audit, secret scan, Slither, and Besu config validation.
- Ran `npm audit --json`; current dependency tree reports 54 vulnerabilities: 19 low, 21 moderate, 11 high, and 3 critical.
- Attempted `npm audit fix`; npm refused the non-forcing fix because of a Hardhat peer-dependency conflict. Breaking `--force` upgrades were not applied.
- Created `docs/dependency-risk-register.md` for unresolved dependency risk.

Legacy contracts still contain plaintext prototype paths and delete-on-revoke behavior; they are retained for backward compatibility and are not used for VCEM claims.
