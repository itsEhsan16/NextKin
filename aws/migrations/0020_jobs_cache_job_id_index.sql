-- migrate:no-transaction
-- 0020 · Finds a cached listing by the id the apps carry (0019's app.job_id_of), one row per id.
-- Built concurrently, so it is this file's one statement; the runner sets lock_timeout and
-- statement_timeout on the session before a no-transaction file (db/migrate.ts).
-- squawk-ignore require-timeout-settings
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS jobs_cache_job_id_idx ON app.jobs_cache (app.job_id_of(apply_url_hash));
