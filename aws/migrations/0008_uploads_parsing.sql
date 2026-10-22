-- 0008 · Uploads, the scan gate and resume parsing (ImBackendImplementationPlan P7; spec §7.4,
-- §9.4.3, §11 `/api/v1/uploads`, `/api/v1/resume-parse`).
-- * uploads: one row per object a user uploads; nothing reads an object until its scan is clean.
-- * resume_parses: the async parse job; its draft is separate from the profile until confirmed.
-- * anonymous_uploads: the §4.1 teaser, keyed by a hash of the IP, purged after 24 hours.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.uploads (
  id            uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id       uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  purpose       text NOT NULL CHECK (purpose IN ('resume', 'jd', 'avatar')),
  bucket        text NOT NULL CHECK (length(bucket) BETWEEN 1 AND 100),
  object_key    text NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 1 AND 500),
  file_name     text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  declared_type text NOT NULL CHECK (length(declared_type) <= 120),
  -- What the bytes are (magic bytes), never the extension or the declared type.
  sniffed_type  text CHECK (length(sniffed_type) <= 120),
  size_bytes    integer CHECK (size_bytes BETWEEN 1 AND 52428800),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanning', 'clean', 'infected', 'failed', 'deleted')),
  scan_result   jsonb,
  confirmed_at  timestamptz,
  scanned_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
CREATE INDEX uploads_user_idx ON app.uploads (user_id, created_at DESC);
-- The orphan sweep reads pending rows by age.
CREATE INDEX uploads_pending_idx ON app.uploads (created_at) WHERE status = 'pending';
CREATE TRIGGER uploads_touch BEFORE UPDATE ON app.uploads FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.uploads');

CREATE TABLE app.resume_parses (
  id            uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id       uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  upload_id     uuid NOT NULL,
  status        text NOT NULL DEFAULT 'waiting_scan' CHECK (status IN ('waiting_scan', 'queued', 'reading', 'extracting', 'verifying', 'ready', 'failed')),
  attempt       integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  -- The draft the user reviews. Never applied by this table: confirming goes through the profile.
  draft         jsonb,
  -- Hidden text, layout facts, OCR use, and the cross-check's verdicts, shown to the user.
  findings      jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(findings) = 'object'),
  error_code    text CHECK (length(error_code) <= 80),
  error_message text CHECK (length(error_message) <= 500),
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (upload_id, user_id) REFERENCES app.uploads (id, user_id) ON DELETE CASCADE,
  CHECK ((status IN ('ready', 'failed')) = (finished_at IS NOT NULL))
);
CREATE INDEX resume_parses_user_idx ON app.resume_parses (user_id, created_at DESC);
CREATE INDEX resume_parses_upload_idx ON app.resume_parses (upload_id);
CREATE TRIGGER resume_parses_touch BEFORE UPDATE ON app.resume_parses FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.resume_parses');

-- The anonymous teaser (§4.1). No user, so a system table: the API reaches it as the system role
-- with a stated purpose, and the hourly purge deletes anything older than 24 hours.
CREATE TABLE app.anonymous_uploads (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  ip_hash     text NOT NULL CHECK (length(ip_hash) = 64),
  object_key  text NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 1 AND 500),
  file_name   text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanning', 'analysing', 'ready', 'infected', 'failed')),
  findings    jsonb,
  claimed_by  uuid,                                -- the account it was copied to on sign-up
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX anonymous_uploads_age_idx ON app.anonymous_uploads (created_at);
CREATE INDEX anonymous_uploads_ip_idx ON app.anonymous_uploads (ip_hash, created_at);
CREATE TRIGGER anonymous_uploads_touch BEFORE UPDATE ON app.anonymous_uploads FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
ALTER TABLE app.anonymous_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.anonymous_uploads FORCE ROW LEVEL SECURITY;
CREATE POLICY anonymous_uploads_system ON app.anonymous_uploads TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON app.anonymous_uploads TO nextkin_maintenance;
