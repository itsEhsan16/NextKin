-- 0055 · The admin portal's Trust & safety area (toreview §171.13).
-- - generation_failure_actions: a staff member's manual retry or close of a failed run. Append-only;
--   a run's place in the failure queue is read from its latest action against the run's own status
--   and finish time, so nothing here can disagree with the run. A retry clears the run's error, so
--   the action keeps the error code and failed stage it was taken against.
-- - abuse_reports: reports filed against a public shared-report link (§4.1), settled by staff with a
--   reason. The reporter stays anonymous: nothing about them is stored.
-- Both tables are system-only (no user_id column, like ai_calls): staff read them through the
-- read-only role and write them on the maintenance role, with the audit row in the same transaction.
-- Rows go with the user they concern (ON DELETE CASCADE), so a deletion leaves none behind.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.generation_failure_actions (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  generation_id   uuid NOT NULL REFERENCES app.generations (id) ON DELETE CASCADE,
  subject_user_id uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  action          text NOT NULL CHECK (action IN ('retry', 'resolve')),
  error_code      text CHECK (length(error_code) <= 80),
  failed_stage    text CHECK (length(failed_stage) <= 60),
  staff_user_id   uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generation_failure_actions_run_idx ON app.generation_failure_actions (generation_id, created_at DESC);
CREATE INDEX generation_failure_actions_created_idx ON app.generation_failure_actions (created_at);
CREATE INDEX generation_failure_actions_subject_idx ON app.generation_failure_actions (subject_user_id);
CREATE TRIGGER generation_failure_actions_append_only BEFORE UPDATE ON app.generation_failure_actions FOR EACH ROW EXECUTE FUNCTION app.refuse_mutation();
ALTER TABLE app.generation_failure_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.generation_failure_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY generation_failure_actions_system ON app.generation_failure_actions TO nextkin_maintenance USING (true) WITH CHECK (true);
CREATE POLICY generation_failure_actions_staff_read ON app.generation_failure_actions FOR SELECT TO nextkin_readonly
  USING (app.current_app_role() IN ('admin', 'support'));
GRANT SELECT, INSERT, DELETE ON app.generation_failure_actions TO nextkin_maintenance;
GRANT SELECT ON app.generation_failure_actions TO nextkin_readonly;

-- The failure queue reads each run's latest failure from the event log.
CREATE INDEX generation_events_failed_idx ON app.generation_events (created_at) WHERE event = 'failed';

CREATE TABLE app.abuse_reports (
  id               bigint GENERATED ALWAYS AS IDENTITY (START WITH 1001) PRIMARY KEY,
  shared_report_id uuid REFERENCES app.shared_reports (id) ON DELETE SET NULL,
  subject_user_id  uuid REFERENCES app.users (id) ON DELETE CASCADE,
  category         text NOT NULL CHECK (category IN ('impersonation', 'spam', 'harassment', 'copyright')),
  reason           text NOT NULL DEFAULT '' CHECK (length(reason) <= 1000),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  action           text CHECK (action IN ('dismiss', 'disable_link', 'suspend_owner')),
  action_reason    text CHECK (length(action_reason) <= 100),
  action_note      text CHECK (length(action_note) <= 1000),
  acted_by         uuid,
  acted_at         timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'open') = (action IS NULL)),
  CHECK ((status = 'open') = (acted_at IS NULL)),
  CHECK (status <> 'dismissed' OR action = 'dismiss'),
  CHECK (status <> 'resolved' OR action IN ('disable_link', 'suspend_owner'))
);
CREATE INDEX abuse_reports_status_idx ON app.abuse_reports (status, created_at DESC);
CREATE INDEX abuse_reports_subject_idx ON app.abuse_reports (subject_user_id);
CREATE INDEX abuse_reports_link_idx ON app.abuse_reports (shared_report_id);
ALTER TABLE app.abuse_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.abuse_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY abuse_reports_system ON app.abuse_reports TO nextkin_maintenance USING (true) WITH CHECK (true);
CREATE POLICY abuse_reports_staff_read ON app.abuse_reports FOR SELECT TO nextkin_readonly
  USING (app.current_app_role() IN ('admin', 'support'));
GRANT SELECT, INSERT, UPDATE, DELETE ON app.abuse_reports TO nextkin_maintenance;
GRANT SELECT ON app.abuse_reports TO nextkin_readonly;

