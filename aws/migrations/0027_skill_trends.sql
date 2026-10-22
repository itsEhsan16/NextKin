-- 0027 · P11-07 the Skills Explorer's trending list (§7.14): anonymous aggregates only. The daily
-- job counts, per published technology, the distinct users who added it to their profile in the
-- last 30 days, and keeps a row only when that count reaches the threshold. No user id is stored,
-- and a technology few people added never appears, so a row cannot point at anyone.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.skill_trends (
  technology_id uuid PRIMARY KEY REFERENCES app.technologies (id) ON DELETE CASCADE,
  rank          integer NOT NULL CHECK (rank > 0),
  user_count    integer NOT NULL CHECK (user_count > 0),
  window_days   integer NOT NULL CHECK (window_days > 0),
  computed_at   timestamptz NOT NULL DEFAULT now()
);
SELECT app.apply_reference_rls('app.skill_trends');
