-- 0021 · Validates 0019's replaced constraints in their own transaction.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.job_provider_configs VALIDATE CONSTRAINT job_provider_configs_provider_check;
ALTER TABLE app.jobs_cache VALIDATE CONSTRAINT jobs_cache_country_check;
