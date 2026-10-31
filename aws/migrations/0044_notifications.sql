-- 0044 · The notification feed on the server (owner, 2026-10-31; changes D-05). A row records
-- something that really happened: a run finished or failed, a saved job is closing, a payment went
-- through. `dedupe_key` keeps a retried job from saying the same thing twice. Delivery (push, email)
-- is not here: this is the in-app feed.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.notifications (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id     uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('matches', 'closing', 'applications', 'ai', 'billing')),
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 300),
  description text NOT NULL CHECK (length(description) <= 500),
  deep_link   text CHECK (length(deep_link) <= 300),
  visual      jsonb NOT NULL CHECK (jsonb_typeof(visual) = 'object'),
  dedupe_key  text NOT NULL CHECK (length(dedupe_key) BETWEEN 1 AND 200),
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX notifications_user_idx ON app.notifications (user_id, created_at DESC);
CREATE INDEX notifications_created_idx ON app.notifications (created_at);
SELECT app.apply_owner_rls('app.notifications');
