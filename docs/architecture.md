# VCEM Architecture

VCEM adds a separated implementation layer beside the existing DSA/RSA prototype.

## On-chain

- `VCEMRegistry`: pseudonymous actor IDs, active wallets, role assignment, role revocation, actor revocation, and pause controls.
- `VCEMConsent`: participant-controlled versioned consent policies, immutable hash history, SHA-256 consent-state chaining, actor/purpose/scope checks.
- `VCEMAudit`: EIP-712 researcher request verification, replay protection, expiry checks, active consent validation, and authorized access logging with the exact active consent hash.

The legacy contracts remain for compatibility and are not used to assert VCEM guarantees.

## Off-chain

- `services/pseudonymization`: HMAC-SHA-256 pseudonymous ID derivation.
- `services/data-proxy`: AES-256-GCM encrypted artifact helpers and transaction-receipt verification before artifact release.
- `services/fhir-adapter`: fixture mapping helpers for FHIR R4 Consent and AuditEvent examples.
- `scripts/auditVerify.ts`: standalone verifier that reconstructs consent/access binding from on-chain logs.

Sensitive health data, names, emails, raw patient IDs, raw FHIR JSON, and clinical records are not stored in the new VCEM contracts.
