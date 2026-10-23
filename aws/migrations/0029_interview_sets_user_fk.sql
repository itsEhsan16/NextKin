-- 0029 · Corrects 0004: interview_question_sets had no foreign key to its owner, only SET NULL links
-- to the run, the JD and the resume, so deleting an account left its practice sets behind (§16.4:
-- deletion removes everything a user owns). Added NOT VALID here and validated in 0030, so the add
-- takes no long lock.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE app.interview_question_sets
  ADD CONSTRAINT interview_sets_user_fk FOREIGN KEY (user_id) REFERENCES app.users (id) ON DELETE CASCADE NOT VALID;
