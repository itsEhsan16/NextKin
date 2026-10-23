-- 0032 · P12-06…P12-10 billing as the apps model it:
-- - the card summary the Settings board prints (brand, last four, expiry); the gateway holds the card;
-- - a sequential invoice number per charge (German invoicing needs one; §13.4);
-- - `fake` as a gateway name for the local fake provider (refused outside local and test by config).
-- The widened checks are added NOT VALID here and validated in 0033.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.billing_accounts ADD COLUMN card jsonb CHECK (card IS NULL OR jsonb_typeof(card) = 'object');
ALTER TABLE app.payments ADD COLUMN invoice_number text;  -- unique: 0034, built concurrently
CREATE SEQUENCE app.invoice_number_seq;
GRANT USAGE ON SEQUENCE app.invoice_number_seq TO nextkin_app;

-- Widening, not removing: the wider check replaces it in this same transaction.
-- squawk-ignore ban-drop-constraint
ALTER TABLE app.webhook_events DROP CONSTRAINT webhook_events_provider_check;
ALTER TABLE app.webhook_events ADD CONSTRAINT webhook_events_provider_check CHECK (provider IN ('stripe', 'razorpay', 'fake')) NOT VALID;
-- squawk-ignore ban-drop-constraint
ALTER TABLE app.billing_accounts DROP CONSTRAINT billing_accounts_gateway_check;
ALTER TABLE app.billing_accounts ADD CONSTRAINT billing_accounts_gateway_check CHECK (gateway IN ('stripe', 'razorpay', 'fake')) NOT VALID;
