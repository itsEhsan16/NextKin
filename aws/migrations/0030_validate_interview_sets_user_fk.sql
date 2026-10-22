-- 0030 · Validates 0029's foreign key: every existing set must belong to an existing user.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.interview_question_sets VALIDATE CONSTRAINT interview_sets_user_fk;
