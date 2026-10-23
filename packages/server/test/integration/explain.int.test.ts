import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { migrate } from '../../src/db/migrate';
import { generateVolume } from '../../src/seed/volume';

/**
 * The EXPLAIN gate (ImBackendImplementationPlan P2-09, R-03). The hot queries run against
 * synthetic volume, as the app role with an identity bound (so the RLS predicate is part of the
 * plan), and none may sequentially scan a large table. An index that looks right on an empty
 * table is often not used at all; this is where that shows. Runs in its own scratch database.
 */
const config = loadConfig();
const SCRATCH = 'nextkin_explain_test';
const VOLUME_USERS = 5_000;
const LARGE_TABLE_ROWS = 10_000;

let adminUrl: string;
let appUrl: string;
let sample: { userId: string; resumeId: string; generationId: string };

const withDb = (base: string) => {
  const url = new URL(base);
  url.pathname = `/${SCRATCH}`;
  return url.toString();
};

async function adminQuery<T extends pg.QueryResultRow>(url: string, text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await adminQuery(config.DATABASE_ADMIN_URL!, `drop database if exists ${SCRATCH} with (force)`);
  await adminQuery(config.DATABASE_ADMIN_URL!, `create database ${SCRATCH} owner nextkin_owner`);
  adminUrl = withDb(config.DATABASE_ADMIN_URL!);
  appUrl = withDb(config.DATABASE_URL);
  await migrate({ ownerUrl: withDb(config.DATABASE_OWNER_URL!), dir: join(import.meta.dirname, '../../../../aws/migrations') });
  await generateVolume(adminUrl, { users: VOLUME_USERS });
  const [row] = await adminQuery<{ user_id: string; resume_id: string; generation_id: string }>(
    adminUrl,
    `select r.user_id, r.id as resume_id, g.id as generation_id
       from app.resumes r join app.generations g on g.user_id = r.user_id
      where r.trashed_at is null limit 1`,
  );
  sample = { userId: row!.user_id, resumeId: row!.resume_id, generationId: row!.generation_id };
}, 120_000);

afterAll(async () => {
  await adminQuery(config.DATABASE_ADMIN_URL!, `drop database if exists ${SCRATCH} with (force)`);
});

interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  Plans?: PlanNode[];
}

function seqScans(node: PlanNode, found: string[] = []): string[] {
  if (node['Node Type'] === 'Seq Scan' && node['Relation Name']) found.push(node['Relation Name']);
  for (const child of node.Plans ?? []) seqScans(child, found);
  return found;
}

async function explainAsUser(text: string, values: unknown[]): Promise<PlanNode> {
  const client = new pg.Client({ connectionString: appUrl });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('app.user_id', $1, true), set_config('app.role', 'user', true)`, [sample.userId]);
    const { rows } = await client.query<{ 'QUERY PLAN': { Plan: PlanNode }[] }>(`explain (format json) ${text}`, values);
    await client.query('rollback');
    return rows[0]!['QUERY PLAN'][0]!.Plan;
  } finally {
    await client.end();
  }
}

// The queries the first screens run (dashboard, library, versions, progress, profile).
const HOT_QUERIES: Record<string, () => [string, unknown[]]> = {
  'resume library': () => [
    'select id, title, updated_at from app.resumes where user_id = $1 and trashed_at is null order by updated_at desc limit 20',
    [sample.userId],
  ],
  'resume versions': () => ['select id, version_number from app.resume_versions where resume_id = $1 order by version_number desc', [sample.resumeId]],
  'generation status': () => ['select status, current_stage from app.generations where id = $1', [sample.generationId]],
  'active generation': () => [
    `select id from app.generations where user_id = $1 and status not in ('ready', 'failed') order by created_at desc limit 1`,
    [sample.userId],
  ],
  'SSE replay': () => ['select id, event, snapshot from app.generation_events where generation_id = $1 and id > $2 order by id', [sample.generationId, 0]],
  'dashboard: resume count': () => ['select count(*) from app.resumes where user_id = $1 and trashed_at is null', [sample.userId]],
  'activity feed': () => ['select id, title from app.activity where user_id = $1 order by created_at desc limit 20', [sample.userId]],
  'profile roles': () => ['select id, company, title from app.experience where user_id = $1 order by start_date desc', [sample.userId]],
  'resume versions for a user': () => ['select count(*) from app.resume_versions where user_id = $1', [sample.userId]],
};

describe('EXPLAIN gate: hot queries never scan a large table', () => {
  it('the volume is large enough to matter', async () => {
    const [row] = await adminQuery<{ n: number }>(adminUrl, `select count(*)::int as n from app.resume_versions`);
    expect(row!.n).toBeGreaterThan(LARGE_TABLE_ROWS);
  });

  for (const [name, build] of Object.entries(HOT_QUERIES)) {
    it(name, async () => {
      const [text, values] = build();
      const plan = await explainAsUser(text, values);
      const large = await adminQuery<{ relname: string }>(
        adminUrl,
        `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'app' and c.relkind = 'r' and c.reltuples > $1`,
        [LARGE_TABLE_ROWS],
      );
      const largeNames = new Set(large.map((r) => r.relname));
      expect(seqScans(plan).filter((t) => largeNames.has(t))).toEqual([]);
    });
  }
});
