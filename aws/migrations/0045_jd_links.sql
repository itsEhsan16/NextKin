-- 0045 · A job description read from a link (owner, 2026-10-18; toreview §144.3). `source_url` is
-- the address the candidate gave; the page's text lands in `raw_text` once it has been read.
-- The wider check is added NOT VALID here and validated in 0046.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.job_descriptions ADD COLUMN source_url text CHECK (length(source_url) <= 2000);

ALTER TABLE app.job_descriptions DROP CONSTRAINT job_descriptions_source_check;
ALTER TABLE app.job_descriptions
  ADD CONSTRAINT job_descriptions_source_check CHECK (source IN ('file', 'paste', 'job', 'link')) NOT VALID;
