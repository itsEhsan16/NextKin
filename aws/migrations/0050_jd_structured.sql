-- 0050 · The structured job description (owner, 2026-11-03; toreview §153). The reading itself lives
-- in `extracted.structured` (JSONB, versioned inside); `structure_version` says which version a row
-- holds, so rows read before it can be found and read again once. `stage` is where a reading is
-- while `extracting` (reading the file or page, understanding it, checking it), so the page can
-- show the real step instead of a generic spinner.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.job_descriptions
  ADD COLUMN structure_version smallint CHECK (structure_version BETWEEN 1 AND 100),
  ADD COLUMN stage text CHECK (stage IN ('reading', 'understanding', 'checking'));
