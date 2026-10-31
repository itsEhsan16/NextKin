-- 0046 · Validates the check 0045 added.

SET lock_timeout = '5s';

ALTER TABLE app.job_descriptions VALIDATE CONSTRAINT job_descriptions_source_check;
