-- 0031 · P12-09 quotas charged on completion, without a race (G2). A run reserves its slot when it
-- starts (one conditional update: used + reserved < limit), the slot becomes a charge when the run
-- succeeds, and it is released when the run fails, is cancelled or times out. So two concurrent
-- runs cannot pass a cap, and a failed run costs nothing. The run records what it reserved, so a
-- retry or a redelivery never charges or releases twice. Plans carry a price-book version (P12-08):
-- a price change is a new version, never an edit under a live subscription.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.usage_counters ADD COLUMN reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0);
ALTER TABLE app.generations ADD COLUMN quota_reservation jsonb CHECK (quota_reservation IS NULL OR jsonb_typeof(quota_reservation) = 'array');
ALTER TABLE app.generations ADD COLUMN quota_released_at timestamptz;
ALTER TABLE app.plans ADD COLUMN price_version integer NOT NULL DEFAULT 1 CHECK (price_version > 0);
