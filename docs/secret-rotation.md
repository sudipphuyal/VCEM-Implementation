# Secret Rotation

Treat the previously tracked `.env` as exposed.

Rotate:

- Blockchain deployer/private accounts used in `.env`.
- Validator keys for any Besu network initialized with exposed material.
- RPC provider keys.
- API keys.
- Database credentials.
- Participant encryption keys used by the data proxy.
- Pseudonymization HMAC secret.
- ZKP trusted setup artifacts if the toxic waste ceremony cannot be verified or was generated in an untrusted environment.

After rotation, store secrets only in local environment files, secret managers, KMS/HSM systems, or CI secret stores. Never commit real secrets.
