-- 0003 · Technology Knowledge Base, skills dictionary, profile skill tags, and the versioned
-- method tables (spec §7.7, §7.8, §10; plan M2-10, Q-01, Q-02).
-- §10 lists technologies without safe_usage_year, aliases or status; §7.7's verdicts need all
-- three, so they are here (the spec's own rules win over its table sketch).

CREATE TABLE app.kb_dataset_versions (
  version      integer PRIMARY KEY CHECK (version > 0),
  notes        text,
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
SELECT app.apply_reference_rls('app.kb_dataset_versions');

CREATE TABLE app.technologies (
  id                       uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  name                     text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  slug                     text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category                 text NOT NULL CHECK (length(category) BETWEEN 1 AND 80),
  aliases                  text[] NOT NULL DEFAULT '{}',
  release_year             smallint CHECK (release_year BETWEEN 1940 AND 2100),
  enterprise_adoption_year smallint CHECK (enterprise_adoption_year BETWEEN 1940 AND 2100),
  safe_usage_year          smallint CHECK (safe_usage_year BETWEEN 1940 AND 2100),
  latest_version           text CHECK (length(latest_version) <= 40),
  status                   text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'superseded')),
  -- Only reviewed or published entries may produce a hard-fail verdict (§7.7); llm_seeded ones
  -- validate in flag-only mode. Only published entries appear in the Skills Explorer (§7.14).
  review_status            text NOT NULL DEFAULT 'llm_seeded' CHECK (review_status IN ('llm_seeded', 'admin_reviewed', 'published')),
  source_citation          text,                   -- approving a date requires a cited source (Q-02)
  dataset_version          integer NOT NULL REFERENCES app.kb_dataset_versions (version),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (safe_usage_year IS NULL OR release_year IS NULL OR safe_usage_year >= release_year),
  CHECK (safe_usage_year IS NULL OR enterprise_adoption_year IS NULL OR safe_usage_year <= enterprise_adoption_year),
  CHECK (review_status = 'llm_seeded' OR release_year IS NULL OR source_citation IS NOT NULL)
);
CREATE INDEX technologies_category_idx ON app.technologies (category) WHERE review_status = 'published';
CREATE INDEX technologies_name_trgm_idx ON app.technologies USING gin (lower(name) gin_trgm_ops);
CREATE TRIGGER technologies_touch BEFORE UPDATE ON app.technologies FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
-- Unreviewed entries are invisible to the public (they 404 in the Skills Explorer); the pipeline
-- reads them through a system or staff session.
SELECT app.apply_reference_rls('app.technologies', $$review_status = 'published'$$);

CREATE TABLE app.technology_relations (
  from_technology_id uuid NOT NULL REFERENCES app.technologies (id) ON DELETE CASCADE,
  to_technology_id   uuid NOT NULL REFERENCES app.technologies (id) ON DELETE CASCADE,
  kind               text NOT NULL CHECK (kind IN ('related', 'successor', 'alternative', 'part_of')),
  PRIMARY KEY (from_technology_id, to_technology_id, kind),
  CHECK (from_technology_id <> to_technology_id)
);
CREATE INDEX technology_relations_to_idx ON app.technology_relations (to_technology_id);
SELECT app.apply_reference_rls('app.technology_relations');

-- The normalized skill dictionary (Q-02's canonical ids). Admin-curated (§7.17).
CREATE TABLE app.skills (
  id             uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  canonical_name text NOT NULL UNIQUE CHECK (length(canonical_name) BETWEEN 1 AND 120),
  aliases        text[] NOT NULL DEFAULT '{}',
  technology_id  uuid REFERENCES app.technologies (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skills_aliases_idx ON app.skills USING gin (aliases);
CREATE TRIGGER skills_touch BEFORE UPDATE ON app.skills FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_reference_rls('app.skills');

-- What the user typed is kept verbatim; skill_id is filled once the normalizer resolves it.
CREATE TABLE app.profile_skills (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id     uuid NOT NULL REFERENCES app.profiles (user_id) ON DELETE CASCADE,
  raw_name    text NOT NULL CHECK (length(raw_name) BETWEEN 1 AND 120),
  skill_id    uuid REFERENCES app.skills (id) ON DELETE SET NULL,
  proficiency text CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years       smallint CHECK (years BETWEEN 0 AND 70),
  provenance  text NOT NULL DEFAULT 'user' CHECK (provenance IN ('user', 'parsed_confirmed', 'assumed')),
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, raw_name)
);
SELECT app.apply_owner_rls('app.profile_skills');

-- Per-role skills: the core input to anachronism checking (§7.7). user_id is carried so RLS needs
-- no join, and the composite foreign key keeps it consistent with the role's owner.
CREATE TABLE app.experience_skills (
  id            uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  experience_id uuid NOT NULL,
  user_id       uuid NOT NULL,
  raw_name      text NOT NULL CHECK (length(raw_name) BETWEEN 1 AND 120),
  skill_id      uuid REFERENCES app.skills (id) ON DELETE SET NULL,
  provenance    text NOT NULL DEFAULT 'user' CHECK (provenance IN ('user', 'parsed_confirmed', 'assumed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (experience_id, user_id) REFERENCES app.experience (id, user_id) ON DELETE CASCADE,
  UNIQUE (experience_id, raw_name)
);
CREATE INDEX experience_skills_user_idx ON app.experience_skills (user_id);
SELECT app.apply_owner_rls('app.experience_skills');

-- ---------------------------------------------------------------------------------------------
-- Versioned method (Q-01, G12, G15). Stored runs reference these and are never rewritten; a
-- weight change is a new rubric version carrying its rationale and evidence.
CREATE TABLE app.rubric_versions (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  version     text NOT NULL UNIQUE,
  weights     jsonb NOT NULL CHECK (jsonb_typeof(weights) = 'object'),
  bands       jsonb NOT NULL CHECK (jsonb_typeof(bands) = 'object'),
  definitions jsonb NOT NULL DEFAULT '{}',
  rationale   text NOT NULL,
  evidence    text,
  is_current  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rubric_versions_one_current ON app.rubric_versions (is_current) WHERE is_current;
SELECT app.apply_reference_rls('app.rubric_versions');

CREATE TABLE app.taxonomy_versions (
  version    integer PRIMARY KEY CHECK (version > 0),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
SELECT app.apply_reference_rls('app.taxonomy_versions');

CREATE TABLE app.market_profile_versions (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  market     text NOT NULL CHECK (market IN ('US', 'DE', 'AU')),
  version    integer NOT NULL CHECK (version > 0),
  profile    jsonb NOT NULL CHECK (jsonb_typeof(profile) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market, version)
);
SELECT app.apply_reference_rls('app.market_profile_versions');
