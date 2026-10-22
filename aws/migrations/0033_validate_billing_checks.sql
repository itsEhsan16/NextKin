-- 0033 · Validates 0032's widened gateway checks.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.webhook_events VALIDATE CONSTRAINT webhook_events_provider_check;
ALTER TABLE app.billing_accounts VALIDATE CONSTRAINT billing_accounts_gateway_check;
