-- 0011 · A document outlives the run that wrote it (P9). resume_versions, ats_reports and
-- cover_letters point at their generation with a plain foreign key, and deleting a user cascades into
-- them along two paths (through generations, and through resumes): the generation-side check fires
-- before the resume-side cascade has removed the rows, and the delete fails. A deleted run now only
-- clears the pointer, as interview_question_sets already does. Added NOT VALID here and validated in
-- 0012, so neither step holds a long lock on a live table.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- Each dropped constraint is replaced in the same transaction by one that keeps the guarantee and
-- only adds the delete rule, so no reader ever sees the reference unchecked.

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.resume_versions DROP CONSTRAINT resume_versions_generation_id_user_id_fkey;
ALTER TABLE app.resume_versions
  ADD CONSTRAINT resume_versions_generation_fk FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id) ON DELETE SET NULL (generation_id) NOT VALID;

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.ats_reports DROP CONSTRAINT ats_reports_generation_id_user_id_fkey;
ALTER TABLE app.ats_reports
  ADD CONSTRAINT ats_reports_generation_fk FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id) ON DELETE SET NULL (generation_id) NOT VALID;

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.cover_letters DROP CONSTRAINT cover_letters_generation_id_user_id_fkey;
ALTER TABLE app.cover_letters
  ADD CONSTRAINT cover_letters_generation_fk FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id) ON DELETE SET NULL (generation_id) NOT VALID;
