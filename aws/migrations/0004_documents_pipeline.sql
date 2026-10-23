-- 0004 · Prompts, templates, JDs, resumes and their immutable versions, the generation pipeline,
-- scores, cover letters and interview sets (spec §7.5–§7.12, §7.15, §9.3, §10, §12.3).

-- Prompts are data (§12.3, G12): every generation records the exact version that produced it.
CREATE TABLE app.prompt_templates (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  stage       text NOT NULL CHECK (length(stage) BETWEEN 1 AND 60),
  name        text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
SELECT app.apply_reference_rls('app.prompt_templates', 'false');

CREATE TABLE app.prompt_template_versions (
  id                 uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  prompt_template_id uuid NOT NULL REFERENCES app.prompt_templates (id) ON DELETE RESTRICT,
  version            integer NOT NULL CHECK (version > 0),
  body               jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object'),
  status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'staged', 'active', 'archived')),
  eval_run_ref       text,                         -- the passing eval run that allowed publishing
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_template_id, version)
);
CREATE UNIQUE INDEX prompt_template_versions_one_active
  ON app.prompt_template_versions (prompt_template_id) WHERE status = 'active';
SELECT app.apply_reference_rls('app.prompt_template_versions', 'false');

CREATE TABLE app.resume_templates (
  id           uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  ats_safe     boolean NOT NULL,
  certified_at timestamptz,                         -- Q-06: no template publishes without a pass
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  assets       jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR certified_at IS NOT NULL)
);
CREATE TRIGGER resume_templates_touch BEFORE UPDATE ON app.resume_templates FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_reference_rls('app.resume_templates', $$status = 'published'$$);

-- ---------------------------------------------------------------------------------------------
CREATE TABLE app.job_descriptions (
  id           uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id      uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  org_id       uuid,
  source       text NOT NULL CHECK (source IN ('file', 'paste', 'job')),
  s3_key       text,
  raw_text     text NOT NULL DEFAULT '' CHECK (length(raw_text) <= 20000),
  content_hash text,                                -- the 30-day extraction cache key (§9.11)
  extracted    jsonb,                               -- what the model read, with source spans (M2-01)
  edited       jsonb,                               -- the user's corrections; generation consumes these
  language     text CHECK (language IN ('en', 'de')),
  jobs_cache_id uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  CHECK (source <> 'file' OR s3_key IS NOT NULL)
);
CREATE INDEX job_descriptions_user_idx ON app.job_descriptions (user_id, created_at DESC);
CREATE TRIGGER job_descriptions_touch BEFORE UPDATE ON app.job_descriptions FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.job_descriptions', 'user_id', true);

-- A resume is a container; its versions are frozen snapshots (§7.11).
CREATE TABLE app.resumes (
  id                 uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id            uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  org_id             uuid,
  title              text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  doc_type           text NOT NULL DEFAULT 'resume' CHECK (doc_type IN ('resume', 'cover_letter')),
  source             text NOT NULL CHECK (source IN ('uploaded', 'generated', 'zero_resume', 'manual')),
  template_id        uuid REFERENCES app.resume_templates (id) ON DELETE SET NULL,
  is_base            boolean NOT NULL DEFAULT false,
  current_version_id uuid,
  job_description_id uuid,
  target_company     text CHECK (length(target_company) <= 200),
  target_role        text CHECK (length(target_role) <= 200),
  tags               text[] NOT NULL DEFAULT '{}',
  trashed_at         timestamptz,                   -- 30-day recoverable trash, then a hard purge
  archived_at        timestamptz,
  row_version        integer NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  FOREIGN KEY (job_description_id, user_id) REFERENCES app.job_descriptions (id, user_id)
);
CREATE INDEX resumes_user_list_idx ON app.resumes (user_id, updated_at DESC) WHERE trashed_at IS NULL;
CREATE INDEX resumes_trash_idx ON app.resumes (trashed_at) WHERE trashed_at IS NOT NULL;
CREATE UNIQUE INDEX resumes_one_base ON app.resumes (user_id) WHERE is_base AND trashed_at IS NULL;
CREATE TRIGGER resumes_touch BEFORE UPDATE ON app.resumes FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER resumes_version BEFORE UPDATE ON app.resumes FOR EACH ROW EXECUTE FUNCTION app.bump_row_version();
SELECT app.apply_owner_rls('app.resumes', 'user_id', true);

-- ---------------------------------------------------------------------------------------------
-- Every AI pipeline run (§7.6, §9.3). The checkpoint holds stage outputs by reference so a
-- redelivered message resumes at the first incomplete stage; quota is charged only on the
-- terminal success transaction (G2).
CREATE TABLE app.generations (
  id                         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id                    uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  org_id                     uuid,
  kind                       text NOT NULL CHECK (kind IN ('resume', 'cover_letter', 'zero_resume', 'ats_check', 'interview')),
  status                     text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'validating', 'scoring', 'ready', 'failed')),
  current_stage              text,
  attempt                    integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  checkpoint                 jsonb NOT NULL DEFAULT '{}',
  stage_log                  jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(stage_log) = 'array'),
  input                      jsonb NOT NULL DEFAULT '{}',
  provenance                 jsonb,                 -- the G12 stamp: prompt, KB, taxonomy, rubric, engine, models, as_of
  idempotency_key            text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  job_description_id         uuid,
  resume_id                  uuid,
  source_resume_id           uuid,
  prompt_template_version_id uuid REFERENCES app.prompt_template_versions (id),
  error_code                 text,
  error_message              text CHECK (length(error_message) <= 500),
  cancel_requested_at        timestamptz,
  quota_charged_at           timestamptz,
  started_at                 timestamptz,
  finished_at                timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  UNIQUE (user_id, idempotency_key),                -- a retried POST /generations starts one job
  FOREIGN KEY (job_description_id, user_id) REFERENCES app.job_descriptions (id, user_id),
  FOREIGN KEY (resume_id, user_id) REFERENCES app.resumes (id, user_id),
  CHECK ((status IN ('ready', 'failed')) = (finished_at IS NOT NULL)),
  CHECK (quota_charged_at IS NULL OR status = 'ready')
);
CREATE INDEX generations_user_idx ON app.generations (user_id, created_at DESC);
-- The 3-minute sweep (M2-04) and getActive() read the non-terminal set only.
CREATE INDEX generations_active_idx ON app.generations (created_at) WHERE status NOT IN ('ready', 'failed');
CREATE TRIGGER generations_touch BEFORE UPDATE ON app.generations FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.generations', 'user_id', true);

-- The SSE replay log (P6-13): Last-Event-ID resumes from here. Append-only.
CREATE TABLE app.generation_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  generation_id uuid NOT NULL,
  user_id       uuid NOT NULL,
  event         text NOT NULL CHECK (event IN ('stage_started', 'stage_completed', 'failed', 'completed')),
  stage         text,
  snapshot      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id) ON DELETE CASCADE
);
CREATE INDEX generation_events_replay_idx ON app.generation_events (generation_id, id);
CREATE INDEX generation_events_user_idx ON app.generation_events (user_id);
CREATE TRIGGER generation_events_append_only BEFORE UPDATE ON app.generation_events FOR EACH ROW EXECUTE FUNCTION app.refuse_mutation();
SELECT app.apply_owner_rls('app.generation_events');
REVOKE UPDATE, DELETE ON app.generation_events FROM nextkin_app;

-- Immutable versions (§7.11). Restoring creates version n+1; history is never rewritten. Only the
-- export keys and the accuracy confirmation may be filled in after the fact.
CREATE TABLE app.resume_versions (
  id                         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  resume_id                  uuid NOT NULL,
  user_id                    uuid NOT NULL,
  generation_id              uuid,
  version_number             integer NOT NULL CHECK (version_number > 0),
  content                    jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  content_schema_version     integer NOT NULL DEFAULT 1,
  content_hash               text NOT NULL,
  claim_ledger               jsonb,                 -- Q-03
  timeline_validation_result jsonb,                 -- §7.7; never rewritten by later KB edits
  export_keys                jsonb NOT NULL DEFAULT '{}',
  change_note                text CHECK (length(change_note) <= 300),
  created_by                 text NOT NULL CHECK (created_by IN ('user', 'generation', 'restore', 'zero_review', 'upload')),
  accuracy_confirmed_at      timestamptz,           -- §15 risk 2: confirmed before the first export
  created_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  UNIQUE (resume_id, version_number),
  FOREIGN KEY (resume_id, user_id) REFERENCES app.resumes (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id)
);
CREATE INDEX resume_versions_user_idx ON app.resume_versions (user_id);

CREATE FUNCTION app.resume_versions_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'export_keys' - 'accuracy_confirmed_at') IS DISTINCT FROM
     (to_jsonb(OLD) - 'export_keys' - 'accuracy_confirmed_at') THEN
    RAISE EXCEPTION 'resume_versions are immutable: create a new version instead'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER resume_versions_immutable BEFORE UPDATE ON app.resume_versions FOR EACH ROW EXECUTE FUNCTION app.resume_versions_guard();
SELECT app.apply_owner_rls('app.resume_versions');

ALTER TABLE app.resumes
  ADD CONSTRAINT resumes_current_version_fk FOREIGN KEY (current_version_id, user_id)
  REFERENCES app.resume_versions (id, user_id) DEFERRABLE INITIALLY DEFERRED;

-- Scores keyed by version, with an optional generation (Q-01: a manual edit scores without one).
-- No total without a JD (D-15): total_bps is null then, and the parts carry the result.
CREATE TABLE app.ats_reports (
  id                uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id           uuid NOT NULL,
  resume_version_id uuid NOT NULL,
  generation_id     uuid,
  rubric_version_id uuid NOT NULL REFERENCES app.rubric_versions (id),
  reason            text NOT NULL CHECK (reason IN ('content_change', 'method_change')),
  has_jd            boolean NOT NULL,
  total_bps         integer CHECK (total_bps BETWEEN 0 AND 10000),
  jd_match_bps      integer CHECK (jd_match_bps BETWEEN 0 AND 10000),
  components        jsonb NOT NULL,
  requirement_ledger jsonb,
  suggestions       jsonb NOT NULL DEFAULT '[]',
  basis             jsonb NOT NULL DEFAULT '{}',
  provenance        jsonb NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (resume_version_id, user_id) REFERENCES app.resume_versions (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id),
  CHECK (has_jd OR (total_bps IS NULL AND jd_match_bps IS NULL))
);
CREATE INDEX ats_reports_version_idx ON app.ats_reports (resume_version_id, created_at DESC);
CREATE INDEX ats_reports_user_idx ON app.ats_reports (user_id);
CREATE TRIGGER ats_reports_append_only BEFORE UPDATE ON app.ats_reports FOR EACH ROW EXECUTE FUNCTION app.refuse_mutation();
SELECT app.apply_owner_rls('app.ats_reports');
REVOKE UPDATE ON app.ats_reports FROM nextkin_app;

CREATE TABLE app.cover_letters (
  id                 uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id            uuid NOT NULL,
  org_id             uuid,
  resume_id          uuid NOT NULL,
  source_version_id  uuid,                          -- the resume version its claims are checked against
  generation_id      uuid,
  job_description_id uuid,
  tone               text NOT NULL DEFAULT 'professional' CHECK (tone IN ('professional', 'confident', 'conversational', 'concise')),
  content            jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  row_version        integer NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (resume_id, user_id) REFERENCES app.resumes (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (source_version_id, user_id) REFERENCES app.resume_versions (id, user_id),
  FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id),
  FOREIGN KEY (job_description_id, user_id) REFERENCES app.job_descriptions (id, user_id)
);
CREATE INDEX cover_letters_user_idx ON app.cover_letters (user_id, updated_at DESC);
CREATE INDEX cover_letters_resume_idx ON app.cover_letters (resume_id);
CREATE TRIGGER cover_letters_touch BEFORE UPDATE ON app.cover_letters FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER cover_letters_version BEFORE UPDATE ON app.cover_letters FOR EACH ROW EXECUTE FUNCTION app.bump_row_version();
SELECT app.apply_owner_rls('app.cover_letters', 'user_id', true);

CREATE TABLE app.interview_question_sets (
  id                  uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id             uuid NOT NULL,
  org_id              uuid,
  generation_id       uuid,
  job_description_id  uuid,
  resume_id           uuid,
  regenerated_from_id uuid REFERENCES app.interview_question_sets (id) ON DELETE SET NULL,
  title               text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  is_generic          boolean NOT NULL DEFAULT false,   -- role-title-only sets are labelled generic (§7.15)
  questions           jsonb NOT NULL CHECK (jsonb_typeof(questions) = 'array'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id) ON DELETE SET NULL (generation_id),
  FOREIGN KEY (job_description_id, user_id) REFERENCES app.job_descriptions (id, user_id) ON DELETE SET NULL (job_description_id),
  FOREIGN KEY (resume_id, user_id) REFERENCES app.resumes (id, user_id) ON DELETE SET NULL (resume_id)
);
CREATE INDEX interview_sets_user_idx ON app.interview_question_sets (user_id, created_at DESC);
CREATE TRIGGER interview_sets_touch BEFORE UPDATE ON app.interview_question_sets FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.interview_question_sets', 'user_id', true);
