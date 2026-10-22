-- migrate:no-transaction
-- 0023 · One set per run: a redelivered interview run that already wrote its set cannot write a
-- second. Built concurrently, so it is this file's one statement; the runner sets lock_timeout and
-- statement_timeout on the session before a no-transaction file (db/migrate.ts).
-- squawk-ignore require-timeout-settings
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS interview_sets_generation_idx ON app.interview_question_sets (generation_id) WHERE generation_id IS NOT NULL;
