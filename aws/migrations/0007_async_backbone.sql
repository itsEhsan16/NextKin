-- 0007 · The async backbone and the AI layer (ImBackendImplementationPlan P6-06, P6-10).
-- Two system tables. Neither holds user content, and neither is readable by the app role:
-- * scheduler_runs: one row per (job, window), so two workers can never enqueue the same run.
-- * ai_calls: one trace row per model call (provider, model, tokens, cost, outcome). It also feeds
--   the per-developer daily spend cap (D-23). Prompts and outputs are never stored here.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.scheduler_runs (
  job          text NOT NULL CHECK (length(job) BETWEEN 1 AND 60),
  window_start timestamptz NOT NULL,
  enqueued_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job, window_start)
);
ALTER TABLE app.scheduler_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.scheduler_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY scheduler_runs_maintenance ON app.scheduler_runs TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, DELETE ON app.scheduler_runs TO nextkin_maintenance;

CREATE TABLE app.ai_calls (
  id                uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  subject_user_id   uuid,                          -- not user_id: a system trace, not a user-owned row; no FK, traces outlive deleted accounts
  generation_id     uuid,
  stage             text NOT NULL CHECK (length(stage) BETWEEN 1 AND 60),
  provider          text NOT NULL CHECK (provider IN ('fake', 'recorded', 'claudeDirect', 'claudeAws', 'bedrock', 'openai')),
  endpoint          text NOT NULL CHECK (length(endpoint) <= 200),
  model             text NOT NULL CHECK (length(model) <= 120),
  prompt_version_id uuid,
  tag               text NOT NULL CHECK (tag IN ('product', 'eval', 'dev')),
  input_tokens      integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens     integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cache_read_tokens integer NOT NULL DEFAULT 0 CHECK (cache_read_tokens >= 0),
  cache_write_tokens integer NOT NULL DEFAULT 0 CHECK (cache_write_tokens >= 0),
  cost_micros       bigint NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),   -- US dollars × 1,000,000
  latency_ms        integer NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  outcome           text NOT NULL CHECK (outcome IN ('ok', 'refusal', 'invalid_output', 'error', 'capped')),
  error_code        text CHECK (length(error_code) <= 80),
  truncated         boolean NOT NULL DEFAULT false,
  correlation_id    text CHECK (length(correlation_id) <= 128),
  developer         text CHECK (length(developer) <= 120),   -- the D-23 cap is per developer
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_calls_generation_idx ON app.ai_calls (generation_id) WHERE generation_id IS NOT NULL;
CREATE INDEX ai_calls_spend_idx ON app.ai_calls (tag, developer, created_at);
ALTER TABLE app.ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ai_calls FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_calls_maintenance ON app.ai_calls TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON app.ai_calls TO nextkin_maintenance;
GRANT SELECT ON app.ai_calls TO nextkin_readonly;
CREATE POLICY ai_calls_readonly ON app.ai_calls FOR SELECT TO nextkin_readonly USING (true);

-- The relay's backoff (P6-02): a row that failed to publish waits until this time before the next try.
ALTER TABLE app.outbox ADD COLUMN next_attempt_at timestamptz;

-- The scheduler enqueues maintenance runs as the system role (P6-06); the relay already reads and
-- marks rows on that role. The app role keeps INSERT only.
GRANT INSERT ON app.outbox TO nextkin_maintenance;
