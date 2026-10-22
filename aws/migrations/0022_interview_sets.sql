-- 0022 · P11-08 interview sets as the apps model them: the employer, the role title of a
-- standalone set, and the listing a set was written for. All nullable; set by the interview stage.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.interview_question_sets ADD COLUMN company text;
ALTER TABLE app.interview_question_sets ADD COLUMN role_title text;
ALTER TABLE app.interview_question_sets ADD COLUMN job_id uuid;
