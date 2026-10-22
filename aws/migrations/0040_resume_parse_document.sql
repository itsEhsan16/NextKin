-- 0040 · An uploaded resume becomes a library resume (toreview §110.4). A parse keeps the resume
-- it read as canonical JSON (`document`: only lines the cross-check found in the file, each the
-- user's own), and the library resume made from it (`resume_id`), so making it twice returns the
-- same resume. Deleting that resume leaves the parse and clears the link.
-- The foreign key is added NOT VALID here and validated in 0041.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.resume_parses
  ADD COLUMN document jsonb CHECK (document IS NULL OR jsonb_typeof(document) = 'object'),
  ADD COLUMN resume_id uuid;

ALTER TABLE app.resume_parses
  ADD CONSTRAINT resume_parses_resume_fk FOREIGN KEY (resume_id, user_id) REFERENCES app.resumes (id, user_id) ON DELETE SET NULL (resume_id) NOT VALID;
