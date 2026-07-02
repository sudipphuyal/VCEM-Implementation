CREATE TABLE IF NOT EXISTS artifact_access (
  participant_id text NOT NULL,
  requestor_id text NOT NULL,
  scope_hash text NOT NULL,
  purpose int NOT NULL,
  data_hash text NOT NULL
);

ALTER TABLE artifact_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS researcher_policy ON artifact_access;
CREATE POLICY researcher_policy ON artifact_access
  USING (requestor_id = current_setting('vcem.requestor_id', true));
