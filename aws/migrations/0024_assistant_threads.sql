-- 0024 · P11-09 the assistant as the apps model it: one current chat per user beside its history,
-- and what the web composer attached to a turn (read, never changed).

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.chat_sessions ADD COLUMN is_current boolean NOT NULL DEFAULT false;
ALTER TABLE app.chat_messages ADD COLUMN attachments jsonb CHECK (attachments IS NULL OR jsonb_typeof(attachments) = 'array');
