-- 0053 · The admin portal's Content area (toreview §171.13): the skills editor and the rubric's
-- rationale byline.
-- - app.skills is the reviewed copy of the skill taxonomy that staff curate. Live scoring keeps the
--   engines' compiled taxonomy (packages/engines datasets/taxonomy.ts) until a release imports the
--   reviewed copy, so an edit here never silently changes a live score.
-- - Categories are reference rows; a skill may have none (a column added nullable: expand only).
-- - A dismissed merge suggestion is remembered, so the same suggestion does not come back.
-- - The rubric's rationale is prose about a version, editable by staff; who last edited it, and
--   when, is kept for its byline. Weights and bands are untouched: they are the engines' code.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.skill_categories (
  id         text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(id) <= 60),
  name       text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 60),
  created_by uuid REFERENCES app.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
SELECT app.apply_reference_rls('app.skill_categories');

ALTER TABLE app.skills ADD COLUMN category_id text REFERENCES app.skill_categories (id) ON DELETE SET NULL;
ALTER TABLE app.skills ADD COLUMN parent text CHECK (length(parent) <= 80);
ALTER TABLE app.skills ADD COLUMN updated_by uuid REFERENCES app.users (id) ON DELETE SET NULL;
CREATE INDEX skills_category_idx ON app.skills (category_id);

CREATE TABLE app.skill_merge_dismissals (
  term_key     text PRIMARY KEY CHECK (length(term_key) BETWEEN 1 AND 120),
  skill_id     uuid NOT NULL REFERENCES app.skills (id) ON DELETE CASCADE,
  dismissed_by uuid REFERENCES app.users (id) ON DELETE SET NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now()
);
SELECT app.apply_reference_rls('app.skill_merge_dismissals');

ALTER TABLE app.rubric_versions ADD COLUMN rationale_updated_by uuid REFERENCES app.users (id) ON DELETE SET NULL;
ALTER TABLE app.rubric_versions ADD COLUMN rationale_updated_at timestamptz;
