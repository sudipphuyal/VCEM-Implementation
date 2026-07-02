# Privacy and Erasure

VCEM keeps sensitive health data off-chain. The blockchain stores pseudonymous `bytes32` identifiers, hashes, timestamps, policy metadata, consent hashes, and audit references.

Off-chain artifact fixtures use AES-256-GCM. Each participant can have a distinct encryption key. Cryptographic erasure is represented by destroying the participant key and deleting encrypted artifacts from the artifact store. On-chain hashes and audit records remain immutable and should be treated as retained integrity/audit metadata.

Pseudonymization uses HMAC-SHA-256 with an institution-controlled off-chain secret. The secret must never be committed, printed, or stored on-chain.
