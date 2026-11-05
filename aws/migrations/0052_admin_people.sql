-- 0052 · The admin portal's People area (toreview §171.13): the deletion ledger.
-- - Deleting an account signs it out at once and the daily purge removes the user row, cascading
--   through everything it owns (`services/privacy.ts`). Nothing recorded the request once the row
--   was gone, so the deletion queue (spec §8.5: 30 days at most) could neither show what is still
--   open nor prove what was finished. This ledger is that record: who it was about (an id only,
--   no name or address), who asked, when, when it is due and when the purge finished.
-- - The column is `subject_user_id`, not `user_id`, and carries no foreign key: the row outlives
--   the account it describes, so it is not a user-owned row.
-- - Only the system role writes it; staff read it through the read-only role (`withStaff`).

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.account_deletions (
  id                 uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  subject_user_id    uuid NOT NULL,
  origin             text NOT NULL CHECK (origin IN ('user', 'admin')),
  requested_by       uuid,
  requested_at       timestamptz NOT NULL DEFAULT now(),
  due_at             timestamptz NOT NULL DEFAULT now() + interval '30 days',
  purge_requested_at timestamptz,
  completed_at       timestamptz,
  CHECK (origin = 'user' OR requested_by IS NOT NULL),
  CHECK (due_at > requested_at),
  CHECK (completed_at IS NULL OR completed_at >= requested_at)
);
CREATE UNIQUE INDEX account_deletions_open_subject_idx ON app.account_deletions (subject_user_id) WHERE completed_at IS NULL;
CREATE INDEX account_deletions_requested_idx ON app.account_deletions (requested_at DESC);
ALTER TABLE app.account_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.account_deletions FORCE ROW LEVEL SECURITY;
CREATE POLICY account_deletions_system ON app.account_deletions TO nextkin_maintenance USING (true) WITH CHECK (true);
CREATE POLICY account_deletions_staff_read ON app.account_deletions FOR SELECT TO nextkin_readonly USING (app.current_app_role() IN ('admin', 'support'));
GRANT SELECT, INSERT, UPDATE ON app.account_deletions TO nextkin_maintenance;
GRANT SELECT ON app.account_deletions TO nextkin_readonly;

-- Accounts already deleted and waiting for the purge: one open request each, dated as the account
-- records it. An admin made it where the audit log holds that admin's `user.delete`.
INSERT INTO app.account_deletions (subject_user_id, origin, requested_by, requested_at, due_at)
SELECT u.id,
       CASE WHEN a.actor_user_id IS NULL THEN 'user' ELSE 'admin' END,
       a.actor_user_id,
       coalesce(u.deletion_requested_at, u.updated_at),
       coalesce(u.deletion_requested_at, u.updated_at) + interval '30 days'
FROM app.users u
LEFT JOIN LATERAL (
  SELECT l.actor_user_id FROM app.audit_logs l
  WHERE l.action = 'user.delete' AND l.target_type = 'user' AND l.target_id = u.id::text
  ORDER BY l.created_at DESC LIMIT 1
) a ON true
WHERE u.status = 'deleted';
