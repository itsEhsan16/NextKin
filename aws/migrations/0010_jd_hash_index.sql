-- migrate:no-transaction
-- 0010 · The 30-day JD extraction cache is keyed by content hash (§9.11; P9-01). Built
-- concurrently, so it runs outside a transaction and holds this one statement only: a second
-- statement would put it in an implicit transaction block. The runner sets lock_timeout and
-- statement_timeout on the session before a no-transaction file (db/migrate.ts).
-- squawk-ignore require-timeout-settings
CREATE INDEX CONCURRENTLY job_descriptions_hash_idx ON app.job_descriptions (content_hash) WHERE status = 'ready';
