-- 0042 · A resume version typeset by LaTeX (toreview §111). Each version is compiled once per
-- template revision, density and paper size on the worker; the PDF and one PNG per page are kept in
-- the exports bucket under users/<user>/renders/<version>/, and the row holds their keys, so the
-- preview shows the very pages the download holds and a purge deletes the objects by reference.
-- Deleting the resume or the version deletes its renders.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.resume_renders (
  id                 uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id            uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  resume_id          uuid NOT NULL,
  resume_version_id  uuid NOT NULL,
  template_slug      text NOT NULL CHECK (length(template_slug) BETWEEN 1 AND 80),
  template_rev       smallint NOT NULL CHECK (template_rev >= 1),
  -- 0 is the template as designed; 1 and 2 tighten spacing to fit a page budget.
  density            smallint NOT NULL CHECK (density BETWEEN 0 AND 2),
  paper              text NOT NULL CHECK (paper IN ('letter', 'a4')),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  pdf_key            text CHECK (length(pdf_key) <= 400),
  -- [{ key, width, height }] in page order, PNG pixels.
  page_keys          jsonb CHECK (page_keys IS NULL OR jsonb_typeof(page_keys) = 'array'),
  page_count         smallint CHECK (page_count >= 1),
  size_bytes         integer CHECK (size_bytes >= 0),
  tex_sha256         text CHECK (length(tex_sha256) = 64),
  -- lint | compile | timeout | busy | rejected | unavailable: why the last attempt failed.
  error_code         text CHECK (length(error_code) <= 40),
  created_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  FOREIGN KEY (resume_id, user_id) REFERENCES app.resumes (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (resume_version_id, user_id) REFERENCES app.resume_versions (id, user_id) ON DELETE CASCADE,
  UNIQUE (resume_version_id, template_slug, template_rev, density, paper),
  CHECK ((status = 'pending') = (completed_at IS NULL)),
  CHECK (status <> 'ready' OR (pdf_key IS NOT NULL AND page_keys IS NOT NULL AND page_count IS NOT NULL))
);
CREATE INDEX resume_renders_resume_idx ON app.resume_renders (resume_id, created_at DESC);
CREATE INDEX resume_renders_user_idx ON app.resume_renders (user_id, created_at DESC);
SELECT app.apply_owner_rls('app.resume_renders', 'user_id');
