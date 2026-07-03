CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS baseline_delivery_ledger CASCADE;
DROP TABLE IF EXISTS baseline_artifacts CASCADE;
DROP TABLE IF EXISTS baseline_consent_policy CASCADE;
DROP TABLE IF EXISTS baseline_sessions CASCADE;
DROP TABLE IF EXISTS baseline_researchers CASCADE;

CREATE TABLE baseline_researchers (
  requestor_id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('researcher')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE baseline_sessions (
  token_hash TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  requestor_id TEXT NOT NULL REFERENCES baseline_researchers(requestor_id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE baseline_consent_policy (
  participant_id TEXT NOT NULL,
  requestor_id TEXT NOT NULL REFERENCES baseline_researchers(requestor_id),
  purpose INT NOT NULL,
  scope_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (participant_id, requestor_id, purpose, scope_hash)
);

CREATE TABLE baseline_artifacts (
  data_hash TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  scope_hash TEXT NOT NULL,
  ciphertext BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  tag BYTEA NOT NULL,
  key_id TEXT NOT NULL,
  plaintext_sha256 TEXT NOT NULL
);

CREATE TABLE baseline_delivery_ledger (
  request_id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  requestor_id TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  release_result TEXT NOT NULL CHECK (release_result IN ('released', 'denied')),
  error_code TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE baseline_researchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_consent_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_delivery_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY baseline_researcher_active ON baseline_researchers
  USING (
    requestor_id = current_setting('vcem.requestor_id', true)
    AND active = TRUE
    AND revoked_at IS NULL
    AND role = 'researcher'
  );

CREATE POLICY baseline_session_active ON baseline_sessions
  USING (
    requestor_id = current_setting('vcem.requestor_id', true)
    AND token_hash = current_setting('vcem.token_hash', true)
    AND revoked_at IS NULL
    AND expires_at > NOW()
  );

CREATE POLICY baseline_policy_authorized ON baseline_consent_policy
  USING (
    requestor_id = current_setting('vcem.requestor_id', true)
    AND participant_id = current_setting('vcem.participant_id', true)
    AND scope_hash = current_setting('vcem.scope_hash', true)
    AND purpose = current_setting('vcem.purpose', true)::INT
    AND active = TRUE
    AND revoked_at IS NULL
  );

CREATE POLICY baseline_artifact_participant_scope ON baseline_artifacts
  USING (
    participant_id = current_setting('vcem.participant_id', true)
    AND scope_hash = current_setting('vcem.scope_hash', true)
    AND data_hash = current_setting('vcem.data_hash', true)
  );

CREATE POLICY baseline_delivery_own ON baseline_delivery_ledger
  USING (requestor_id = current_setting('vcem.requestor_id', true))
  WITH CHECK (requestor_id = current_setting('vcem.requestor_id', true));

CREATE OR REPLACE FUNCTION baseline_authorize_artifact(
  p_token_hash TEXT,
  p_participant_id TEXT,
  p_requestor_id TEXT,
  p_data_hash TEXT,
  p_scope_hash TEXT,
  p_purpose INT,
  p_request_id TEXT
)
RETURNS TABLE(data_hash TEXT, ciphertext BYTEA, iv BYTEA, tag BYTEA, key_id TEXT, plaintext_sha256 TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  PERFORM set_config('vcem.token_hash', p_token_hash, true);
  PERFORM set_config('vcem.participant_id', p_participant_id, true);
  PERFORM set_config('vcem.requestor_id', p_requestor_id, true);
  PERFORM set_config('vcem.data_hash', p_data_hash, true);
  PERFORM set_config('vcem.scope_hash', p_scope_hash, true);
  PERFORM set_config('vcem.purpose', p_purpose::TEXT, true);

  IF EXISTS (SELECT 1 FROM baseline_delivery_ledger WHERE request_id = p_request_id) THEN
    RAISE EXCEPTION 'duplicate request id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM baseline_sessions WHERE token_hash = p_token_hash) THEN
    INSERT INTO baseline_delivery_ledger(request_id, participant_id, requestor_id, data_hash, release_result, error_code)
    VALUES (p_request_id, p_participant_id, p_requestor_id, p_data_hash, 'denied', 'INVALID_SESSION');
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM baseline_researchers WHERE requestor_id = p_requestor_id) THEN
    INSERT INTO baseline_delivery_ledger(request_id, participant_id, requestor_id, data_hash, release_result, error_code)
    VALUES (p_request_id, p_participant_id, p_requestor_id, p_data_hash, 'denied', 'INVALID_RESEARCHER');
    RAISE EXCEPTION 'invalid researcher';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM baseline_consent_policy WHERE participant_id = p_participant_id AND requestor_id = p_requestor_id AND purpose = p_purpose AND scope_hash = p_scope_hash) THEN
    INSERT INTO baseline_delivery_ledger(request_id, participant_id, requestor_id, data_hash, release_result, error_code)
    VALUES (p_request_id, p_participant_id, p_requestor_id, p_data_hash, 'denied', 'POLICY_DENIED');
    RAISE EXCEPTION 'policy denied';
  END IF;

  INSERT INTO baseline_delivery_ledger(request_id, participant_id, requestor_id, data_hash, release_result)
  VALUES (p_request_id, p_participant_id, p_requestor_id, p_data_hash, 'released');

  RETURN QUERY
  SELECT a.data_hash, a.ciphertext, a.iv, a.tag, a.key_id, a.plaintext_sha256
  FROM baseline_artifacts a
  WHERE a.data_hash = p_data_hash
    AND a.participant_id = p_participant_id
    AND a.scope_hash = p_scope_hash;
END;
$$;
