-- 0014 · Validates 0013's foreign keys in their own transaction.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.resume_versions VALIDATE CONSTRAINT resume_versions_generation_cascade_fk;
ALTER TABLE app.ats_reports VALIDATE CONSTRAINT ats_reports_generation_cascade_fk;
ALTER TABLE app.cover_letters VALIDATE CONSTRAINT cover_letters_generation_cascade_fk;
