-- 0049 · Push (owner, 2026-11-01; V2 §9.12: Amazon SNS mobile push). `push_devices` holds a phone that
-- said yes, with the time zone it reported, so quiet hours and a 9am nudge land on its clock.
-- `endpoint_arn` is its SNS address, made by the worker on first send: the web process never holds
-- SNS access. A token belongs to one account: signing in on the same phone moves it.
-- `push_messages` is what's waiting to leave. A row claims itself by setting `sent_at` before it
-- sends, so an overlapping run can't push twice, and `outcome` says what became of it. Deleting a
-- notification takes its waiting push with it.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.push_devices (
  id           uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id      uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  platform     text NOT NULL CHECK (platform IN ('android', 'ios')),
  token        text NOT NULL UNIQUE CHECK (length(token) BETWEEN 1 AND 4096),
  time_zone    text NOT NULL DEFAULT 'UTC' CHECK (length(time_zone) BETWEEN 1 AND 64),
  endpoint_arn text CHECK (length(endpoint_arn) <= 1024),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_devices_user_idx ON app.push_devices (user_id);
CREATE TRIGGER push_devices_touch BEFORE UPDATE ON app.push_devices FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.push_devices');

CREATE TABLE app.push_messages (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id         uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  notification_id uuid REFERENCES app.notifications (id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  body            text NOT NULL CHECK (length(body) <= 500),
  url             text CHECK (length(url) <= 300),
  -- 'now' goes when it's due; a 'nudge' is something we chose to raise, at most one a day.
  kind            text NOT NULL CHECK (kind IN ('now', 'nudge')),
  -- Which nudge wins when two land on the same morning: lower first.
  rank            smallint NOT NULL DEFAULT 0,
  due_at          timestamptz NOT NULL,
  sent_at         timestamptz,
  attempts        smallint NOT NULL DEFAULT 0,
  outcome         text CHECK (outcome IN ('sent', 'read', 'capped', 'no_device', 'off', 'failed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_messages_due_idx ON app.push_messages (due_at, rank) WHERE sent_at IS NULL;
CREATE INDEX push_messages_nudge_idx ON app.push_messages (user_id, sent_at) WHERE kind = 'nudge' AND outcome = 'sent';
CREATE INDEX push_messages_notification_idx ON app.push_messages (notification_id) WHERE notification_id IS NOT NULL;
CREATE INDEX push_messages_created_idx ON app.push_messages (created_at);
SELECT app.apply_owner_rls('app.push_messages');
