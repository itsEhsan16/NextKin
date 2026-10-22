-- 0041 · Validates 0040's link from a parse to the resume made from it. No row has one yet.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.resume_parses VALIDATE CONSTRAINT resume_parses_resume_fk;
