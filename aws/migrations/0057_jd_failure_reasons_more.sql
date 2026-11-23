-- 0057 · More reasons a job description could not be read (owner, 2026-11-23; toreview §259).
-- Every model failure used to be filed as `provider` and told the candidate "Try again in a
-- moment", whatever had happened. Each now has its own reason and its own sentence: the service is
-- busy, it is down on our side, the text is too long, the text could not be made sense of, or our
-- own code failed. Expand only: every value 0056 allowed is still allowed.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- 0056 named its check by default; it is found by what it checks, so a different name still goes.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'app.job_descriptions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%failure_reason%'
  LOOP
    EXECUTE format('ALTER TABLE app.job_descriptions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE app.job_descriptions
  ADD CONSTRAINT job_descriptions_failure_reason_check CHECK (
    failure_reason IN (
      'invalid', 'private', 'robots', 'refused', 'gone', 'unsupported', 'too_large', 'timeout',
      'unreachable', 'empty', 'listing', 'removed', 'not_a_job', 'unreadable', 'provider',
      'busy', 'service_down', 'too_long', 'unclear', 'internal'
    )
  );
