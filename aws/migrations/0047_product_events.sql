-- 0047 · Usage events, kept on our own server (owner, 2026-10-31; V2 §8.5). Where people get stuck
-- in the funnel, and nothing else: an event is a name from a fixed list and a few short labels,
-- never what anyone typed. A user who opts out sends none. Purged after 13 months by the daily job.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.product_events (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id     uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  platform    text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  app_version text CHECK (length(app_version) <= 40),
  properties  jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(properties) = 'object'),
  occurred_at timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_events_name_idx ON app.product_events (name, occurred_at DESC);
CREATE INDEX product_events_user_idx ON app.product_events (user_id, occurred_at DESC);
CREATE INDEX product_events_created_idx ON app.product_events (created_at);
SELECT app.apply_owner_rls('app.product_events');
