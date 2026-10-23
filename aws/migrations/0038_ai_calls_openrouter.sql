-- 0038 · `openrouter` as an AI trace provider (toreview §108): the developer route that reaches the
-- same Claude models through OpenRouter. Without it every trace insert from that route fails, the
-- spend it records reads as nothing, and the daily developer cap (D-23) never trips.
-- The widened check is added NOT VALID here and validated in 0039.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- Widening, not removing: the wider check replaces it in this same transaction.
-- squawk-ignore ban-drop-constraint
ALTER TABLE app.ai_calls DROP CONSTRAINT ai_calls_provider_check;
ALTER TABLE app.ai_calls ADD CONSTRAINT ai_calls_provider_check CHECK (provider IN ('fake', 'recorded', 'claudeDirect', 'claudeAws', 'bedrock', 'openai', 'openrouter')) NOT VALID;
