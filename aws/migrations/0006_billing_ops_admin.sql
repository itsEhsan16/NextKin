-- 0006 · Billing and quotas, consent, sessions, idempotency, the transactional outbox, webhook
-- events, the audit log, and admin configuration (spec §7.17, §9.8, §9.11, §10, §13, §17.3;
-- plan P3-03, P6-02, P12, C-14).

-- Entitlements are keyed to an account entity, not a bare user (§17.3), so enterprise workspaces
-- can own a subscription later without a redesign. In Release 1 each user owns one account.
CREATE TABLE app.billing_accounts (
  id                  uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  owner_user_id       uuid NOT NULL UNIQUE REFERENCES app.users (id) ON DELETE CASCADE,
  org_id              uuid,
  billing_country     char(2) CHECK (billing_country ~ '^[A-Z]{2}$'),
  currency            char(3) CHECK (currency IN ('USD', 'EUR', 'AUD')),
  gateway             text CHECK (gateway IN ('stripe', 'razorpay')),
  gateway_customer_id text UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER billing_accounts_touch BEFORE UPDATE ON app.billing_accounts FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.billing_accounts', 'owner_user_id', true);

-- Tiers, prices per currency (minor units) and quota entitlements (§13). A price change is a new
-- row version, never an edit under a live subscription.
CREATE TABLE app.plans (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z0-9_]+$'),
  tier        text NOT NULL CHECK (tier IN ('free', 'pro')),
  name        text NOT NULL,
  period      text CHECK (period IN ('month', 'year')),
  prices      jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(prices) = 'object'),   -- {"USD": 1900, ...}
  quotas      jsonb NOT NULL CHECK (jsonb_typeof(quotas) = 'object'),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
SELECT app.apply_reference_rls('app.plans', 'active');

CREATE TABLE app.subscriptions (
  id                      uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  billing_account_id      uuid NOT NULL REFERENCES app.billing_accounts (id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  org_id                  uuid,
  plan_id                 text NOT NULL REFERENCES app.plans (id),
  status                  text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')),
  gateway_subscription_id text UNIQUE,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  paused_until            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON app.subscriptions (user_id);
CREATE INDEX subscriptions_account_idx ON app.subscriptions (billing_account_id);
CREATE TRIGGER subscriptions_touch BEFORE UPDATE ON app.subscriptions FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.subscriptions', 'user_id', true);

CREATE TABLE app.payments (
  id                 uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  billing_account_id uuid NOT NULL REFERENCES app.billing_accounts (id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  subscription_id    uuid REFERENCES app.subscriptions (id) ON DELETE SET NULL,
  gateway_payment_id text NOT NULL UNIQUE,
  amount_minor       bigint NOT NULL CHECK (amount_minor >= 0),
  currency           char(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'AUD')),
  tax_minor          bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  status             text NOT NULL CHECK (status IN ('succeeded', 'failed', 'refunded', 'pending')),
  invoice_key        text,
  occurred_at        timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_user_idx ON app.payments (user_id, occurred_at DESC);
SELECT app.apply_owner_rls('app.payments');

-- Quota meters (§13.3, G2). Charged with one atomic conditional update on completion, so two
-- concurrent generations cannot race past a cap (P12-09).
CREATE TABLE app.usage_counters (
  user_id      uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  metric       text NOT NULL CHECK (metric IN ('generation', 'ats_check', 'cover_letter', 'zero_resume', 'interview_set', 'assistant_message')),
  period_start date NOT NULL,
  period_end   date NOT NULL,
  used         integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, metric, period_start),
  CHECK (period_end > period_start)
);
SELECT app.apply_owner_rls('app.usage_counters');

-- Explicit consent naming the AI providers, checked by the pipeline before any AI stage (C-14).
CREATE TABLE app.consents (
  id                    uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id               uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  kind                  text NOT NULL CHECK (kind IN ('ai_processing', 'terms', 'privacy', 'analytics')),
  document_version      text NOT NULL,              -- e.g. the provider-list version for ai_processing
  granted_at            timestamptz NOT NULL DEFAULT now(),
  withdrawn_at          timestamptz,
  CHECK (withdrawn_at IS NULL OR withdrawn_at >= granted_at)
);
CREATE INDEX consents_user_idx ON app.consents (user_id, kind, granted_at DESC);
SELECT app.apply_owner_rls('app.consents');

-- ---------------------------------------------------------------------------------------------
-- Durable record of web sessions, for the "active sessions" list and sign-out-everywhere. The
-- live session lives in Valkey (§9.11); this row never holds a token, only a hash of the id.
CREATE TABLE app.sessions (
  id_hash        text PRIMARY KEY CHECK (length(id_hash) = 64),
  user_id        uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  device         text CHECK (device IN ('desktop', 'phone', 'tablet')),
  platform       text CHECK (length(platform) <= 60),
  browser        text CHECK (length(browser) <= 60),
  location       text CHECK (length(location) <= 120),
  client         text NOT NULL CHECK (client IN ('web', 'ios', 'android')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_idx ON app.sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expiry_idx ON app.sessions (expires_at);
SELECT app.apply_owner_rls('app.sessions');

-- The database backstop for Idempotency-Key (P3-03). Valkey answers first; this survives a flush.
CREATE TABLE app.idempotency_keys (
  user_id             uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  key                 text NOT NULL CHECK (length(key) BETWEEN 8 AND 200),
  request_fingerprint text NOT NULL,
  status_code         smallint,
  response            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (user_id, key)
);
CREATE INDEX idempotency_keys_expiry_idx ON app.idempotency_keys (expires_at);
SELECT app.apply_owner_rls('app.idempotency_keys');

-- The transactional outbox (P6-02): written in the same transaction as the business change, so a
-- committed change always produces its message. The relay (worker, maintenance role) publishes.
CREATE TABLE app.outbox (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  queue            text NOT NULL CHECK (queue IN ('generation-priority', 'generation-standard', 'maintenance')),
  message_group_id text NOT NULL,
  payload          jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  correlation_id   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  published_at     timestamptz,
  attempts         integer NOT NULL DEFAULT 0,
  last_error       text CHECK (length(last_error) <= 500)
);
CREATE INDEX outbox_pending_idx ON app.outbox (id) WHERE published_at IS NULL;
ALTER TABLE app.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_enqueue ON app.outbox FOR INSERT TO nextkin_app WITH CHECK (published_at IS NULL);
CREATE POLICY outbox_relay ON app.outbox TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT INSERT ON app.outbox TO nextkin_app;
GRANT SELECT, UPDATE, DELETE ON app.outbox TO nextkin_maintenance;

-- Persist-then-process (§9.8): every verified inbound webhook is stored before it is handled,
-- and the provider's event id makes a replay a no-op.
CREATE TABLE app.webhook_events (
  id           uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  provider     text NOT NULL CHECK (provider IN ('stripe', 'razorpay')),
  event_id     text NOT NULL,
  type         text NOT NULL,
  payload      jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error        text CHECK (length(error) <= 500),
  UNIQUE (provider, event_id)
);
CREATE INDEX webhook_events_pending_idx ON app.webhook_events (received_at) WHERE processed_at IS NULL;
ALTER TABLE app.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.webhook_events FORCE ROW LEVEL SECURITY;
CREATE POLICY webhook_persist ON app.webhook_events FOR INSERT TO nextkin_app WITH CHECK (processed_at IS NULL);
CREATE POLICY webhook_process ON app.webhook_events TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT INSERT ON app.webhook_events TO nextkin_app;
GRANT SELECT, UPDATE ON app.webhook_events TO nextkin_maintenance;

-- ---------------------------------------------------------------------------------------------
-- Append-only audit of admin and security-relevant actions (§7.17). No path deletes or edits a
-- row: a trigger refuses it and no runtime role holds UPDATE or DELETE. Exported nightly to the
-- Object Lock archive.
CREATE TABLE app.audit_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  actor_role    text NOT NULL,
  action        text NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
  target_type   text,
  target_id     text,
  before        jsonb,
  after         jsonb,
  reason        text CHECK (length(reason) <= 1000),
  ip            inet,
  request_id    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON app.audit_logs (created_at);
CREATE INDEX audit_logs_target_idx ON app.audit_logs (target_type, target_id);
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON app.audit_logs FOR EACH ROW EXECUTE FUNCTION app.refuse_mutation();
ALTER TABLE app.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_write ON app.audit_logs FOR INSERT TO nextkin_app
  WITH CHECK (actor_user_id IS NOT DISTINCT FROM app.current_user_id());
CREATE POLICY audit_read ON app.audit_logs FOR SELECT TO nextkin_readonly
  USING (app.current_app_role() IN ('admin', 'support'));
CREATE POLICY audit_export ON app.audit_logs FOR SELECT TO nextkin_maintenance USING (true);
GRANT INSERT ON app.audit_logs TO nextkin_app;
GRANT SELECT ON app.audit_logs TO nextkin_readonly, nextkin_maintenance;

-- Global configuration: feature flags, kill switches, the model routing table, quotas (§10).
CREATE TABLE app.app_settings (
  key        text PRIMARY KEY CHECK (key ~ '^[a-z0-9_.]+$'),
  value      jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER app_settings_touch BEFORE UPDATE ON app.app_settings FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_reference_rls('app.app_settings');

-- Job providers: enablement and limits; only the ARN of the key (§7.17: keys are write-only).
CREATE TABLE app.job_provider_configs (
  provider   text PRIMARY KEY CHECK (provider IN ('adzuna', 'jsearch')),
  enabled    boolean NOT NULL DEFAULT false,
  secret_ref text,
  limits     jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER job_provider_configs_touch BEFORE UPDATE ON app.job_provider_configs FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_reference_rls('app.job_provider_configs', 'false');
