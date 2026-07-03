# Data Proxy Security

The production-facing proxy path is `services/data-proxy/policyProxy.ts`.

It does not trust caller-supplied receipts. The proxy fetches the transaction receipt directly from the configured Besu/RPC provider, enforces a fixed chain ID and fixed `VCEMAudit` address, decodes the `AccessAuthorized` event, checks participant ID, requestor ID, data hash, scope, purpose, request ID, consent version, consent hash, actor root, finality, and the authenticated session requestor.

Delivery is one-time by default. `delivery_ledger.request_id` is the primary key and records pseudonymous participant ID, requestor ID, authorization transaction hash, release result, timestamp, and error code. Plaintext health data is never written to the ledger or logs.

## Deprecated Prototype

`services/data-proxy/proxy.ts` is a legacy demonstration helper. It accepted a transaction hash and expected data hash directly and had no authenticated session binding or durable one-time release ledger. Production API code must not import it.

## Erasure

Artifacts are encrypted with AES-256-GCM. The development key provider stores per-participant keys locally for fixtures. The `KmsKeyProvider` interface is the production seam for KMS/HSM integration. Destroying the participant key makes the ciphertext unreadable; ciphertext deletion is optional and separate from immutable on-chain audit records.
