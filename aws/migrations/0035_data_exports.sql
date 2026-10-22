-- 0035 · P12-11 the self-service data export (§8.5): one row per archive the user asked for. The
-- worker builds the archive (every table holding the user's data, plus their files) into the exports
-- bucket; the link is presigned on each read, and the file is purged when the row expires.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.data_exports (
  id           uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id      uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'ready', 'failed')),
  object_key   text,
  size_bytes   bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  error        text CHECK (length(error) <= 500),
  requested_at timestamptz NOT NULL DEFAULT now(),
  ready_at     timestamptz,
  expires_at   timestamptz,
  CHECK (status <> 'ready' OR (object_key IS NOT NULL AND ready_at IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE INDEX data_exports_user_idx ON app.data_exports (user_id, requested_at DESC);
SELECT app.apply_owner_rls('app.data_exports');
