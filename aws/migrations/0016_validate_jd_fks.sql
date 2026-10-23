-- 0016 · Validates 0015's foreign keys in their own transaction.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.resumes VALIDATE CONSTRAINT resumes_jd_fk;
ALTER TABLE app.generations VALIDATE CONSTRAINT generations_jd_fk;
ALTER TABLE app.cover_letters VALIDATE CONSTRAINT cover_letters_jd_fk;
ALTER TABLE app.job_descriptions VALIDATE CONSTRAINT job_descriptions_upload_set_null_fk;
