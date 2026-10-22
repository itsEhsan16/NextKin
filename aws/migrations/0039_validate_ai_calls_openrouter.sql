-- 0039 · Validates 0038's widened AI trace provider check.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.ai_calls VALIDATE CONSTRAINT ai_calls_provider_check;
