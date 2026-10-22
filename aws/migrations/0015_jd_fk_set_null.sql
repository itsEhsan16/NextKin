-- 0015 · A document outlives the job description it was written for, and a JD outlives the file it
-- was read from (P9). resumes, generations and cover_letters referenced the JD, and the JD its
-- upload, with plain foreign keys; deleting a user cascades into them along two paths and the plain
-- check fires before the other path's cascade, so the delete failed. Each now clears only its own
-- pointer column (PostgreSQL 15+'s column list), which those tables allow. Validated in 0016.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- Each dropped constraint is replaced in the same transaction by one that keeps the guarantee and
-- only adds the delete rule.
-- squawk-ignore ban-drop-constraint
ALTER TABLE app.resumes DROP CONSTRAINT resumes_job_description_id_user_id_fkey;
ALTER TABLE app.resumes
  ADD CONSTRAINT resumes_jd_fk FOREIGN KEY (job_description_id, user_id) REFERENCES app.job_descriptions (id, user_id) ON DELETE SET NULL (job_description_id) NOT VALID;

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.generations DROP CONSTRAINT generations_job_description_id_user_id_fkey;
ALTER TABLE app.generations
  ADD CONSTRAINT generations_jd_fk FOREIGN KEY (job_description_id, user_id) REFERENCES app.job_descriptions (id, user_id) ON DELETE SET NULL (job_description_id) NOT VALID;

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.cover_letters DROP CONSTRAINT cover_letters_job_description_id_user_id_fkey;
ALTER TABLE app.cover_letters
  ADD CONSTRAINT cover_letters_jd_fk FOREIGN KEY (job_description_id, user_id) REFERENCES app.job_descriptions (id, user_id) ON DELETE SET NULL (job_description_id) NOT VALID;

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.job_descriptions DROP CONSTRAINT job_descriptions_upload_fk;
ALTER TABLE app.job_descriptions
  ADD CONSTRAINT job_descriptions_upload_set_null_fk FOREIGN KEY (upload_id, user_id) REFERENCES app.uploads (id, user_id) ON DELETE SET NULL (upload_id) NOT VALID;
