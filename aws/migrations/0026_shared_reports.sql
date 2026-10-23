-- 0026 · P11-10 the shareable ATS report (§4.1): a public, PII-redacted snapshot behind a random
-- token. Only the token's SHA-256 is stored; the snapshot is frozen at share time and carries no
-- contact field and no evidence text. Revoking sets revoked_at and the public read stops at once.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.shared_reports (
  id            uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id       uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  org_id        uuid,
  resume_id     uuid,
  ats_report_id uuid REFERENCES app.ats_reports (id) ON DELETE SET NULL,
  token_hash    text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  snapshot      jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  show_employer boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  FOREIGN KEY (resume_id, user_id) REFERENCES app.resumes (id, user_id) ON DELETE SET NULL (resume_id)
);
CREATE INDEX shared_reports_user_idx ON app.shared_reports (user_id, created_at DESC);
SELECT app.apply_owner_rls('app.shared_reports', 'user_id', true);
