# Authentication

The VCEM API uses wallet-based authentication before any access relay or data release.

## Flow

1. `POST /auth/challenge` accepts a wallet address and creates a nonce challenge with expiry.
2. The researcher signs the exact challenge message with the registered wallet.
3. `POST /auth/session` verifies the signature, resolves the wallet to an active researcher ID through `VCEMRegistry`, and creates a short-lived session.
4. Sessions are persisted in PostgreSQL in `auth_sessions`.
5. `POST /auth/revoke` revokes the bearer session token.

The session token is not sufficient for data release. The data proxy also verifies the on-chain `AccessAuthorized` event and checks that the authenticated session requestor ID matches the authorized requestor ID.

## PostgreSQL Migration

```bash
psql "$DATABASE_URL" -f services/api/migrations/001_vcem_api.sql
```

## Endpoints

- `POST /auth/challenge`
- `POST /auth/session`
- `POST /auth/revoke`
- `POST /access/authorize`
- `POST /data/release`

Direct `/storage/*` access is denied.
