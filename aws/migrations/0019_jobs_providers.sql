-- 0019 · P11 job search (ImBackendImplementationPlan P11-01, P11-02).
--
-- 1. A listing's id, everywhere the apps carry one, is derived from its apply-URL hash, so it
--    survives cache purges and is the same across providers that list the same job.
--    app.job_id_of computes it, a version-8 UUID from md5(hash), and src/jobs/ids.ts computes the
--    same in TypeScript. It is never stored on saved_jobs, which keeps no backfill to run behind
--    FORCE row-level security.
-- 2. The local fixture provider gets a config row, and its catalogue may be priced and located
--    outside the three launch markets. The fixture adapter is refused in staging and production (L3).
-- 3. Providers get a priority and a country scope (§9.6), so ordering and disabling them is a
--    settings change.
-- 4. A JD read from a listing records which listing it came from.
--
-- The replaced CHECKs are added NOT VALID and validated in 0021.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE FUNCTION app.job_id_of(apply_url_hash text) RETURNS uuid
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT (substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-8' || substr(h, 14, 3) || '-' ||
          substr('89ab', (('x' || substr(h, 17, 1))::bit(4)::int % 4) + 1, 1) || substr(h, 18, 3) || '-' ||
          substr(h, 21, 12))::uuid
  FROM (SELECT md5(apply_url_hash) AS h) AS s
$$;

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.job_provider_configs DROP CONSTRAINT job_provider_configs_provider_check;
ALTER TABLE app.job_provider_configs
  ADD CONSTRAINT job_provider_configs_provider_check CHECK (provider IN ('adzuna', 'jsearch', 'fixture')) NOT VALID;
ALTER TABLE app.job_provider_configs ADD COLUMN priority integer NOT NULL DEFAULT 100;
ALTER TABLE app.job_provider_configs ADD COLUMN countries text[] NOT NULL DEFAULT '{}';

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.jobs_cache DROP CONSTRAINT jobs_cache_country_check;
ALTER TABLE app.jobs_cache
  ADD CONSTRAINT jobs_cache_country_check CHECK (provider = 'fixture' OR country IN ('US', 'DE', 'AU')) NOT VALID;

ALTER TABLE app.job_descriptions ADD COLUMN job_id uuid;
