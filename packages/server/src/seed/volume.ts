import pg from 'pg';

/**
 * Synthetic volume for EXPLAIN review and load work (ImBackendImplementationPlan P2-08, P2-09,
 * R-03). Bulk inserts with generate_series as the local superuser, because writing hundreds of
 * thousands of rows one RLS-bound transaction at a time would take minutes. Local and test only;
 * the config refuses DATABASE_ADMIN_URL anywhere else.
 *
 * Per user: a profile, 3 roles, 5 resumes with 3 versions each, 4 generations with 3 events each,
 * and 10 activity rows. Every volume user's identity starts with `volume|` so it can be removed.
 */
export interface VolumeCounts {
  users: number;
}

export async function generateVolume(adminUrl: string, counts: VolumeCounts): Promise<void> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(`
      create temporary table vol_users on commit drop as
      select app.uuid_v7() as id, g as n from generate_series(1, $1::int) g`, [counts.users]);

    await client.query(`
      insert into app.users (id, identity_sub, email, first_name, last_name, email_verified)
      select id, 'volume|' || id, 'volume-' || id || '@example.test', 'Vol', 'User' || n, true from vol_users`);
    await client.query(`insert into app.user_settings (user_id) select id from vol_users`);
    await client.query(`insert into app.profiles (user_id, headline, years_experience) select id, 'Engineer', (n % 30) from vol_users`);

    await client.query(`
      insert into app.experience (user_id, company, title, start_date, end_date, end_precision, is_current, sort_order)
      select u.id, 'Company ' || r, 'Engineer', date '2010-01-01' + (r * 900),
             case when r = 3 then null else date '2010-01-01' + (r * 900 + 800) end,
             case when r = 3 then null else 'month' end,
             r = 3, r
      from vol_users u cross join generate_series(1, 3) r`);

    await client.query(`
      create temporary table vol_resumes on commit drop as
      select app.uuid_v7() as id, u.id as user_id, r from vol_users u cross join generate_series(1, 5) r`);
    await client.query(`
      insert into app.resumes (id, user_id, title, source, updated_at, trashed_at)
      select id, user_id, 'Resume ' || r, 'manual', now() - (r || ' days')::interval,
             case when r = 5 then now() - interval '2 days' else null end
      from vol_resumes`);
    await client.query(`
      insert into app.resume_versions (resume_id, user_id, version_number, content, content_hash, created_by)
      select v.id, v.user_id, n, '{"summary":"volume"}'::jsonb, md5(v.id::text || n), 'user'
      from vol_resumes v cross join generate_series(1, 3) n`);

    await client.query(`
      create temporary table vol_generations on commit drop as
      select app.uuid_v7() as id, u.id as user_id, g from vol_users u cross join generate_series(1, 4) g`);
    await client.query(`
      insert into app.generations (id, user_id, kind, status, idempotency_key, finished_at, created_at)
      select id, user_id, 'resume',
             case when g = 4 then 'generating' else 'ready' end,
             'volume-' || id,
             case when g = 4 then null else now() end,
             now() - (g || ' hours')::interval
      from vol_generations`);
    await client.query(`
      insert into app.generation_events (generation_id, user_id, event, stage, snapshot)
      select id, user_id, 'stage_completed', 'stage' || e, '{}'::jsonb
      from vol_generations cross join generate_series(1, 3) e`);

    await client.query(`
      insert into app.activity (user_id, kind, title, created_at)
      select u.id, 'volume', 'Activity ' || a, now() - (a || ' hours')::interval
      from vol_users u cross join generate_series(1, 10) a`);

    await client.query('commit');
    await client.query('analyze');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

export async function removeVolume(adminUrl: string): Promise<number> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const result = await client.query(`delete from app.users where identity_sub like 'volume|%'`);
    return result.rowCount ?? 0;
  } finally {
    await client.end();
  }
}
