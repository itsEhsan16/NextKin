-- migrate:no-transaction
-- 0034 · One invoice number per charge (0032). Built concurrently, so it is this file's one statement;
-- the runner sets lock_timeout and statement_timeout on the session before a no-transaction file.
-- squawk-ignore require-timeout-settings
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS payments_invoice_number_idx ON app.payments (invoice_number) WHERE invoice_number IS NOT NULL;
