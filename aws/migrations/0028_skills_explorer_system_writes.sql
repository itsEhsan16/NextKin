-- 0028 · P11-07 what the system role may write for the Skills Explorer, and nothing more:
-- - the trending job replaces app.skill_trends (anonymous aggregates; 0027);
-- - the KB import files `related` links between machine-seeded entries. Curated (reviewed or
--   published) entries and their links stay staff-only, as 0009 keeps their rows.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE POLICY skill_trends_system_write ON app.skill_trends FOR ALL TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT INSERT, DELETE ON app.skill_trends TO nextkin_maintenance;

CREATE POLICY technology_relations_system_seed ON app.technology_relations FOR INSERT TO nextkin_maintenance
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.technologies t WHERE t.id = from_technology_id AND t.review_status = 'llm_seeded')
    AND EXISTS (SELECT 1 FROM app.technologies t WHERE t.id = to_technology_id AND t.review_status = 'llm_seeded')
  );
GRANT INSERT ON app.technology_relations TO nextkin_maintenance;
