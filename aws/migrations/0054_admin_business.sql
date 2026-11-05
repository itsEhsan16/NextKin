-- 0054 · The admin portal's Business area and Overview (toreview §171.13).
-- - generations.manual_retries: how many times someone pressed retry on the run (the user's retry
--   or a staff retry). V2 §2.2 measures generation reliability "without manual retry", and nothing
--   recorded that until now. A plain counter with a default, so adding it rewrites nothing.
-- - job_provider_calls: each job provider's calls and failures per UTC day, counted where the
--   search fans out (`jobs/aggregate.ts`). The provider pages' traffic share, calls against the
--   daily ceiling and error rate read it; there was no record of either before. Aggregate only:
--   no query, user or listing is stored.
-- - price_book_versions: the Pro monthly and annual prices that took effect together, so the price
--   book has a history. Version 1 is today's prices, with no author (they came from the seed).
--   Plans keep their own current prices; a new version updates both plans in one transaction.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.generations ADD COLUMN manual_retries integer NOT NULL DEFAULT 0 CHECK (manual_retries >= 0);

CREATE TABLE app.job_provider_calls (
  day       date NOT NULL,
  provider  text NOT NULL CHECK (length(provider) BETWEEN 1 AND 40),
  calls     integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
  errors    integer NOT NULL DEFAULT 0 CHECK (errors >= 0 AND errors <= calls),
  PRIMARY KEY (day, provider)
);
SELECT app.apply_reference_rls('app.job_provider_calls', 'false');
-- Counted by the search path as the system role.
CREATE POLICY job_provider_calls_system ON app.job_provider_calls TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT INSERT, UPDATE ON app.job_provider_calls TO nextkin_maintenance;

CREATE TABLE app.price_book_versions (
  version         integer PRIMARY KEY CHECK (version > 0),
  effective_from  timestamptz NOT NULL DEFAULT now(),
  monthly         jsonb NOT NULL,
  annual          jsonb NOT NULL,
  created_by      uuid REFERENCES app.users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
SELECT app.apply_reference_rls('app.price_book_versions', 'false');

INSERT INTO app.price_book_versions (version, monthly, annual)
SELECT 1, m.prices, a.prices
FROM app.plans m, app.plans a
WHERE m.id = 'pro_monthly' AND a.id = 'pro_annual';
