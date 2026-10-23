-- 0013 · Corrects 0011. Clearing the pointer is an UPDATE, and resume_versions (immutable) and
-- ats_reports (append-only) refuse updates by design. A generation is only ever deleted with its
-- user (account deletion, §8.5), when its documents go too, so the documents follow it: CASCADE.
-- Added NOT VALID here and validated in 0014.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- Each dropped constraint is replaced in the same transaction by one that keeps the guarantee and
-- only changes the delete rule, so no reader ever sees the reference unchecked.
-- squawk-ignore ban-drop-constraint
ALTER TABLE app.resume_versions DROP CONSTRAINT resume_versions_generation_fk;
ALTER TABLE app.resume_versions
  ADD CONSTRAINT resume_versions_generation_cascade_fk FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id) ON DELETE CASCADE NOT VALID;

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.ats_reports DROP CONSTRAINT ats_reports_generation_fk;
ALTER TABLE app.ats_reports
  ADD CONSTRAINT ats_reports_generation_cascade_fk FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id) ON DELETE CASCADE NOT VALID;

-- squawk-ignore ban-drop-constraint
ALTER TABLE app.cover_letters DROP CONSTRAINT cover_letters_generation_fk;
ALTER TABLE app.cover_letters
  ADD CONSTRAINT cover_letters_generation_cascade_fk FOREIGN KEY (generation_id, user_id) REFERENCES app.generations (id, user_id) ON DELETE CASCADE NOT VALID;
