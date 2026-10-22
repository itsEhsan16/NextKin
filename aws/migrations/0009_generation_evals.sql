-- 0009 · Generation and evals (ImBackendImplementationPlan P9; spec §7.5–§7.8, §11 `/api/v1/jd`).
-- * job_descriptions: an extraction is a job the client awaits, so it has a status; what was dropped
--   for want of a verified source span is counted; a file JD points at its scanned upload.
-- * kb_review_queue: technologies the timeline engine could not verify (§7.7 "queued for admin
--   review"), counted across runs. Only the system role touches it.
-- * technologies: the system role may add machine-seeded candidates (P9-07), never approve them.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.job_descriptions
  ADD COLUMN status text NOT NULL DEFAULT 'ready' CHECK (status IN ('extracting', 'ready', 'failed')),
  ADD COLUMN error_message text CHECK (length(error_message) <= 300),
  ADD COLUMN stats jsonb,
  ADD COLUMN upload_id uuid;

-- NOT VALID and left so: every row written before this has no upload_id, and new rows are checked.
ALTER TABLE app.job_descriptions
  ADD CONSTRAINT job_descriptions_upload_fk FOREIGN KEY (upload_id, user_id) REFERENCES app.uploads (id, user_id) NOT VALID;

CREATE TABLE app.kb_review_queue (
  name_key       text PRIMARY KEY CHECK (length(name_key) BETWEEN 1 AND 120),
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  occurrences    integer NOT NULL DEFAULT 1 CHECK (occurrences > 0),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'seeded', 'not_technology', 'failed')),
  technology_id  uuid REFERENCES app.technologies (id) ON DELETE SET NULL,
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz
);
CREATE INDEX kb_review_queue_pending_idx ON app.kb_review_queue (occurrences DESC) WHERE status = 'pending';
ALTER TABLE app.kb_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.kb_review_queue FORCE ROW LEVEL SECURITY;
CREATE POLICY kb_review_queue_system ON app.kb_review_queue TO nextkin_maintenance USING (true) WITH CHECK (true);
CREATE POLICY kb_review_queue_staff_read ON app.kb_review_queue FOR SELECT TO nextkin_app USING (app.current_app_role() IN ('admin', 'curator'));
GRANT SELECT, INSERT, UPDATE ON app.kb_review_queue TO nextkin_maintenance;
GRANT SELECT ON app.kb_review_queue TO nextkin_app;

-- Candidates only: the system role inserts llm_seeded rows and can never mark one reviewed.
CREATE POLICY technologies_system_seed ON app.technologies FOR INSERT TO nextkin_maintenance WITH CHECK (review_status = 'llm_seeded');
GRANT INSERT ON app.technologies TO nextkin_maintenance;
