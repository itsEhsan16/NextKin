-- 0043 · Applications on the server (owner, 2026-10-31; changes D-05). NextKin never applies for
-- anyone: a row records what the candidate told us. It starts as 'asking', the app asks "Did you
-- apply?" when `ask_after` has passed, and an answer moves it on: 'applied' joins the Applied list,
-- 'declined' ends the asking, and a second "not yet" leaves it 'asking' with no `ask_after`.
-- `job` is the listing as the apps model it, so a row outlives its listing in the cache.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.applications (
  id           uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id      uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  -- A listing's id (`app.job_id_of`), or one derived from a job description with no listing.
  job_id       uuid NOT NULL,
  resume_id    uuid,
  status       text NOT NULL DEFAULT 'asking'
    CHECK (status IN ('asking', 'declined', 'applied', 'viewed', 'in_review', 'interview', 'offer', 'not_selected', 'withdrawn')),
  job          jsonb NOT NULL CHECK (jsonb_typeof(job) = 'object'),
  ask_after    timestamptz,
  asks_left    smallint NOT NULL DEFAULT 2 CHECK (asks_left BETWEEN 0 AND 2),
  applied_at   timestamptz,
  interview_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id),
  FOREIGN KEY (resume_id, user_id) REFERENCES app.resumes (id, user_id) ON DELETE SET NULL (resume_id),
  CHECK ((status IN ('asking', 'declined')) = (applied_at IS NULL))
);
CREATE INDEX applications_asks_idx ON app.applications (user_id, ask_after) WHERE status = 'asking' AND ask_after IS NOT NULL;
CREATE INDEX applications_applied_idx ON app.applications (user_id, applied_at DESC) WHERE applied_at IS NOT NULL;
CREATE INDEX applications_resume_idx ON app.applications (resume_id) WHERE resume_id IS NOT NULL;
CREATE TRIGGER applications_touch BEFORE UPDATE ON app.applications FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.applications');
