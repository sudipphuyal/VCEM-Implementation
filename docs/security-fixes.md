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
- Ran `npm audit --audit-level=low`; current dependency tree reports 59 vulnerabilities: 19 low, 24 moderate, 12 high, and 4 critical. Several suggested fixes require breaking upgrades to Hardhat/Ethers-related tooling and were not applied in this pass.
- Attempted `npm run slither`; Slither is not installed in the current environment.

Legacy contracts still contain plaintext prototype paths and delete-on-revoke behavior; they are retained for backward compatibility and are not used for VCEM claims.
