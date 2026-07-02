# Threat Model

## Assets

- Off-chain encrypted health artifacts.
- Participant encryption keys.
- Pseudonymization secret.
- Consent-state hash chain.
- Access authorization logs.
- Researcher signing keys.

## Adversaries

- Unauthorized researcher.
- Policy gateway attempting to fabricate requests.
- Data proxy caller without a valid authorization transaction.
- Actor replaying old request IDs.
- Application server operator attempting to rewrite off-chain state.
- Observer relying on stale consent state.

## Controls

- EIP-712 request signatures bind access requests to active researcher wallets.
- `VCEMAudit` validates consent in the same transaction that records access.
- `requestId` replay protection rejects duplicate requests.
- Expiry timestamps reject stale requests.
- `expectedConsentHash` rejects outdated consent state.
- Consent versions are hash chained and never deleted.
- Data proxy verifies an on-chain `AccessAuthorized` event before decryption.

## Residual Risks

- The fixture data proxy is not a hardened production API.
- Pseudonymization depends on secret custody.
- Besu validator key generation is scaffolded, not executed.
- ZKP authorization semantics remain experimental.
