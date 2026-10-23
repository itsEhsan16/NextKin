-- 0012 · Validates 0011's foreign keys in their own transaction (a SHARE UPDATE EXCLUSIVE lock only).

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.resume_versions VALIDATE CONSTRAINT resume_versions_generation_fk;
ALTER TABLE app.ats_reports VALIDATE CONSTRAINT ats_reports_generation_fk;
ALTER TABLE app.cover_letters VALIDATE CONSTRAINT cover_letters_generation_fk;
