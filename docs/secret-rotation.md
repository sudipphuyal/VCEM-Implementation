# Secret Rotation

Treat the previously tracked `.env` as exposed.

Rotate:

- Blockchain deployer/private accounts used in `.env`.
- Validator keys for any Besu network initialized with exposed material.
- RPC provider keys.
- API keys.
- Database credentials.
- Participant encryption keys used by the data proxy.
- API session signing/nonce secrets if introduced by a deployment wrapper.
- Pseudonymization HMAC secret.
- ZKP trusted setup artifacts if the toxic waste ceremony cannot be verified or was generated in an untrusted environment.

After rotation, store secrets only in local environment files, secret managers, KMS/HSM systems, PostgreSQL secret stores with restricted roles, or CI secret stores. Never commit real secrets.

PostgreSQL credentials in `DATABASE_URL` should be rotated together with API deployment credentials. Participant encryption key rotation requires re-encrypting off-chain artifacts or intentionally destroying access through cryptographic erasure.
