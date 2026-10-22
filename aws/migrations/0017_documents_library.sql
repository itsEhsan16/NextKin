-- 0017 · P10 documents and library (ImBackendImplementationPlan P10-01…P10-08).
--
-- 1. Deleting a resume (permanently, or by the 30-day trash purge) no longer trips over the runs
--    and letters that point at it. A generation keeps its record with the resume cleared; a cover
--    letter keeps its body with the source version cleared. Each delete rule touches only its own
--    column, and neither table is immutable, so clearing is an ordinary update.
-- 2. Generations gain the `section` kind: regenerating one section of an existing resume (P10-02)
--    runs on the worker like any other generation.
-- 3. export_events records every export (V2 §7.12: "export events are recorded per user (format,
--    template, timestamp)") and holds the reference to its rendered file, so a purge deletes the
--    objects by reference, never by a blind lifecycle rule (§7.11).
--
-- The replaced constraints are added NOT VALID and validated in 0018.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.generations DROP CONSTRAINT generations_resume_id_user_id_fkey;
ALTER TABLE app.generations
  ADD CONSTRAINT generations_resume_fk FOREIGN KEY (resume_id, user_id) REFERENCES app.resumes (id, user_id) ON DELETE SET NULL (resume_id) NOT VALID;

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.cover_letters DROP CONSTRAINT cover_letters_source_version_id_user_id_fkey;
ALTER TABLE app.cover_letters
  ADD CONSTRAINT cover_letters_source_version_fk FOREIGN KEY (source_version_id, user_id) REFERENCES app.resume_versions (id, user_id) ON DELETE SET NULL (source_version_id) NOT VALID;

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.generations DROP CONSTRAINT generations_kind_check;
ALTER TABLE app.generations
  ADD CONSTRAINT generations_kind_check CHECK (kind IN ('resume', 'cover_letter', 'zero_resume', 'ats_check', 'interview', 'section')) NOT VALID;

CREATE TABLE app.export_events (
  id                 uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id            uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  org_id             uuid,
  resume_id          uuid NOT NULL,
  resume_version_id  uuid NOT NULL,
  format             text NOT NULL CHECK (format IN ('pdf', 'docx', 'txt')),
  template_slug      text NOT NULL CHECK (length(template_slug) BETWEEN 1 AND 80),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  -- users/<user>/exports/<version>/<id>.<format> in the exports bucket; set once rendered.
  object_key         text CHECK (length(object_key) <= 400),
  file_name          text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  size_bytes         integer CHECK (size_bytes >= 0),
  -- Q-06: the file read back and compared with the canonical model. ats_safe is false when any
  -- section or claim was lost, and the apps drop the "ATS-safe" label.
  ats_safe           boolean,
  parse_back         jsonb,
  error_message      text CHECK (length(error_message) <= 500),
  created_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  FOREIGN KEY (resume_id, user_id) REFERENCES app.resumes (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (resume_version_id, user_id) REFERENCES app.resume_versions (id, user_id) ON DELETE CASCADE,
  CHECK ((status = 'pending') = (completed_at IS NULL)),
  CHECK (status <> 'ready' OR object_key IS NOT NULL)
);
-- A version's file is rendered once per format and template and reused until it expires.
CREATE INDEX export_events_version_idx ON app.export_events (resume_version_id, format, template_slug, created_at DESC);
CREATE INDEX export_events_user_idx ON app.export_events (user_id, created_at DESC);
SELECT app.apply_owner_rls('app.export_events', 'user_id', true);
