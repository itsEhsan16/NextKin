-- 0037 · P12-01…P12-05 the admin API.
-- - Staff actions on a user's rows (suspend, reactivate, comped access, a deletion) run on the system
--   role, and their audit row is written in the same transaction, attributed to the named staff
--   member: the system role may insert audit rows only with an actor. Still no UPDATE or DELETE.
-- - A prompt version reaches production only with a passing eval (§7.17, P12-03): each evaluation
--   is recorded here, requested by staff and finished by the worker.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE POLICY audit_system_write ON app.audit_logs FOR INSERT TO nextkin_maintenance WITH CHECK (actor_user_id IS NOT NULL);
GRANT INSERT ON app.audit_logs TO nextkin_maintenance;

CREATE TABLE app.prompt_evaluations (
  id                uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  prompt_version_id uuid NOT NULL REFERENCES app.prompt_template_versions (id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'passed', 'failed', 'unsupported')),
  mode              text CHECK (mode IN ('reference', 'recorded', 'live')),
  report            jsonb,
  requested_by      uuid NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz
);
CREATE INDEX prompt_evaluations_version_idx ON app.prompt_evaluations (prompt_version_id, created_at DESC);
SELECT app.apply_reference_rls('app.prompt_evaluations', 'false');
CREATE POLICY prompt_evaluations_system ON app.prompt_evaluations TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT UPDATE ON app.prompt_evaluations TO nextkin_maintenance;
CREATE POLICY prompt_versions_system_eval ON app.prompt_template_versions FOR UPDATE TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT UPDATE (eval_run_ref) ON app.prompt_template_versions TO nextkin_maintenance;
