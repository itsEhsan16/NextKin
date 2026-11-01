-- 0048 · Following up on applications (owner, 2026-11-01). NextKin can't see employers, so it asks:
-- 7 and 21 days after applying, then it stops. `checked_at` is the last time the candidate said where
-- an application stands, which is what answers a follow-up. `follow_ups_sent` counts the asks filed.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.applications
  ADD COLUMN checked_at timestamptz,
  ADD COLUMN follow_ups_sent smallint NOT NULL DEFAULT 0 CHECK (follow_ups_sent BETWEEN 0 AND 2);

CREATE INDEX applications_open_idx ON app.applications (applied_at)
  WHERE status IN ('applied', 'viewed', 'in_review');
CREATE INDEX applications_interview_idx ON app.applications (interview_at)
  WHERE status = 'interview' AND interview_at IS NOT NULL;
