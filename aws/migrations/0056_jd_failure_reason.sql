-- 0056 · Why a job description could not be read (owner, 2026-11-15; toreview §206). Until now a
-- failed reading kept only its sentence (`error_message`), so no screen could tell a list of jobs
-- from a posting that was taken down from a site that refused. The reason is one of a fixed set;
-- the sentence stays, and is what the candidate reads.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.job_descriptions
  ADD COLUMN failure_reason text CHECK (
    failure_reason IN (
      'invalid', 'private', 'robots', 'refused', 'gone', 'unsupported', 'too_large', 'timeout',
      'unreachable', 'empty', 'listing', 'removed', 'not_a_job', 'unreadable', 'provider'
    )
  );
