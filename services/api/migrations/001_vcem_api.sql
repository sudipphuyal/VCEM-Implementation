CREATE TABLE IF NOT EXISTS auth_challenges (
  nonce TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  requestor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS auth_sessions_wallet_idx ON auth_sessions(wallet);
CREATE INDEX IF NOT EXISTS auth_sessions_requestor_idx ON auth_sessions(requestor_id);

CREATE TABLE IF NOT EXISTS delivery_ledger (
  request_id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  requestor_id TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  authorization_tx_hash TEXT NOT NULL,
  release_result TEXT NOT NULL,
  error_code TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS delivery_ledger_requestor_idx ON delivery_ledger(requestor_id);
CREATE INDEX IF NOT EXISTS delivery_ledger_participant_idx ON delivery_ledger(participant_id);
