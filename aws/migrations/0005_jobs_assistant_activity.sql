-- 0005 · Job listings, saved jobs, the AI assistant, activity, quality flags and the user-visible
-- security events (spec §7.13, §7.16, §9.6, §10; plan Q-09).

-- Normalized listing metadata only, never full provider descriptions (§9.6), purged at expiry.
-- Shared by all users, so it is reference data: the app role reads and caches; maintenance purges.
CREATE TABLE app.jobs_cache (
  id               uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  apply_url_hash   text NOT NULL UNIQUE,            -- dedup key (§7.13)
  provider         text NOT NULL CHECK (provider IN ('adzuna', 'jsearch', 'fixture')),
  provider_job_id  text NOT NULL,
  title            text NOT NULL CHECK (length(title) <= 300),
  company          text NOT NULL CHECK (length(company) <= 200),
  location         text CHECK (length(location) <= 200),
  country          text NOT NULL CHECK (country IN ('US', 'DE', 'AU')),
  normalized       jsonb NOT NULL CHECK (jsonb_typeof(normalized) = 'object'),
  description_kind text NOT NULL CHECK (description_kind IN ('full', 'snippet', 'title_only')),
  fetched_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  UNIQUE (provider, provider_job_id),
  CHECK (expires_at > fetched_at AND expires_at <= fetched_at + interval '72 hours')
);
CREATE INDEX jobs_cache_expiry_idx ON app.jobs_cache (expires_at);
CREATE INDEX jobs_cache_dedupe_trgm_idx ON app.jobs_cache USING gin (lower(title || ' ' || company) gin_trgm_ops);
ALTER TABLE app.jobs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.jobs_cache FORCE ROW LEVEL SECURITY;
CREATE POLICY cache_read ON app.jobs_cache FOR SELECT TO nextkin_app, nextkin_readonly USING (true);
CREATE POLICY cache_write ON app.jobs_cache FOR INSERT TO nextkin_app WITH CHECK (true);
CREATE POLICY cache_refresh ON app.jobs_cache FOR UPDATE TO nextkin_app USING (true) WITH CHECK (true);
CREATE POLICY cache_purge ON app.jobs_cache TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON app.jobs_cache TO nextkin_app;
GRANT SELECT, DELETE ON app.jobs_cache TO nextkin_maintenance;
GRANT SELECT ON app.jobs_cache TO nextkin_readonly;

ALTER TABLE app.job_descriptions
  ADD CONSTRAINT job_descriptions_jobs_cache_fk FOREIGN KEY (jobs_cache_id) REFERENCES app.jobs_cache (id) ON DELETE SET NULL;

-- A saved job keeps its own snapshot (provider display terms permitting), so it outlives the cache
-- row; expired listings are flagged, not deleted (§7.13).
CREATE TABLE app.saved_jobs (
  id             uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id        uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  apply_url_hash text NOT NULL,
  jobs_cache_id  uuid REFERENCES app.jobs_cache (id) ON DELETE SET NULL,
  snapshot       jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  notes          text CHECK (length(notes) <= 2000),
  expired_at     timestamptz,
  saved_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, apply_url_hash)                  -- setSaved(id, true) is idempotent
);
CREATE INDEX saved_jobs_user_idx ON app.saved_jobs (user_id, saved_at DESC);
SELECT app.apply_owner_rls('app.saved_jobs');

-- ---------------------------------------------------------------------------------------------
-- The assistant (§7.16): read-and-advise only. A thread is a session.
CREATE TABLE app.chat_sessions (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id    uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  org_id     uuid,
  title      text CHECK (length(title) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
CREATE INDEX chat_sessions_user_idx ON app.chat_sessions (user_id, updated_at DESC);
CREATE TRIGGER chat_sessions_touch BEFORE UPDATE ON app.chat_sessions FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.chat_sessions', 'user_id', true);

CREATE TABLE app.chat_messages (
  id                uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  session_id        uuid NOT NULL,
  user_id           uuid NOT NULL,
  role              text NOT NULL CHECK (role IN ('user', 'assistant')),
  content           text NOT NULL CHECK (length(content) <= 20000),
  status            text NOT NULL DEFAULT 'complete' CHECK (status IN ('streaming', 'complete', 'failed')),
  refusal           text CHECK (refusal IN ('off_topic')),
  classification    jsonb,                          -- the domain-lock result for declined messages
  context_resume_id uuid,
  tokens_in         integer CHECK (tokens_in >= 0),
  tokens_out        integer CHECK (tokens_out >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id, user_id) REFERENCES app.chat_sessions (id, user_id) ON DELETE CASCADE
);
CREATE INDEX chat_messages_session_idx ON app.chat_messages (session_id, created_at);
CREATE INDEX chat_messages_user_idx ON app.chat_messages (user_id);
SELECT app.apply_owner_rls('app.chat_messages');

-- ---------------------------------------------------------------------------------------------
-- The activity feed the dashboard shows (userRepo.listActivity).
CREATE TABLE app.activity (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id    uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (length(kind) BETWEEN 1 AND 40),
  title      text NOT NULL CHECK (length(title) <= 300),
  detail     text CHECK (length(detail) <= 500),
  deep_link  text CHECK (length(deep_link) <= 300),
  resume_id  uuid,
  job_ref    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_user_idx ON app.activity (user_id, created_at DESC);
SELECT app.apply_owner_rls('app.activity');

-- Q-09: "flag this validation" and "this isn't accurate". A disputed claim never reappears.
CREATE TABLE app.quality_flags (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id     uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('validation_flag', 'claim_dispute')),
  subject     jsonb NOT NULL CHECK (jsonb_typeof(subject) = 'object'),
  reason      text CHECK (length(reason) <= 1000),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX quality_flags_user_idx ON app.quality_flags (user_id);
CREATE INDEX quality_flags_open_idx ON app.quality_flags (created_at) WHERE status = 'open';
SELECT app.apply_owner_rls('app.quality_flags');

-- Security events the user can see on their own account (sign-ins, password changes, sessions
-- revoked, exports). Append-only. Admin actions go to app.audit_logs instead.
CREATE TABLE app.security_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('sign_up', 'sign_in', 'sign_in_failed', 'sign_out', 'sign_out_all',
                                           'password_changed', 'password_reset', 'email_changed',
                                           'session_revoked', 'data_export', 'deletion_requested', 'provider_linked', 'provider_unlinked')),
  ip         inet,
  user_agent text CHECK (length(user_agent) <= 400),
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX security_events_user_idx ON app.security_events (user_id, created_at DESC);
CREATE TRIGGER security_events_append_only BEFORE UPDATE ON app.security_events FOR EACH ROW EXECUTE FUNCTION app.refuse_mutation();
SELECT app.apply_owner_rls('app.security_events');
REVOKE UPDATE, DELETE ON app.security_events FROM nextkin_app;
