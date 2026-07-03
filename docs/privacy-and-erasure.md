# Privacy and Erasure

VCEM keeps sensitive health data off-chain. The blockchain stores pseudonymous `bytes32` identifiers, hashes, timestamps, policy metadata, consent hashes, and audit references.

Off-chain artifact fixtures use AES-256-GCM. Each participant can have a distinct encryption key. The development key provider is local-only; production integrations should implement the KMS/HSM interface in `services/encryption/keyProvider.ts`.

Cryptographic erasure is represented by destroying the participant key. Once the key is destroyed, the encrypted artifact is unreadable even if the ciphertext remains. Ciphertext deletion is supported by the artifact store and may be performed where policy requires it. On-chain hashes and audit records remain immutable and should be treated as retained integrity/audit metadata.

The delivery ledger stores only pseudonymous participant IDs, requestor IDs, data hashes, authorization transaction hashes, release result, timestamp, and error code. It must not store plaintext clinical data.

Pseudonymization uses HMAC-SHA-256 with an institution-controlled off-chain secret. The secret must never be committed, printed, or stored on-chain.
