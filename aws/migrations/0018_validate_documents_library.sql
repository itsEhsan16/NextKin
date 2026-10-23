-- 0018 · Validates 0017's replaced constraints in their own transaction.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.generations VALIDATE CONSTRAINT generations_resume_fk;
ALTER TABLE app.cover_letters VALIDATE CONSTRAINT cover_letters_source_version_fk;
ALTER TABLE app.generations VALIDATE CONSTRAINT generations_kind_check;
