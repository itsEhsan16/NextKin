-- migrate:no-transaction
-- 0025 · At most one current chat per user. Built concurrently, so it is this file's one statement;
-- the runner sets lock_timeout and statement_timeout on the session before a no-transaction file.
-- squawk-ignore require-timeout-settings
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS chat_sessions_current_idx ON app.chat_sessions (user_id) WHERE is_current;
