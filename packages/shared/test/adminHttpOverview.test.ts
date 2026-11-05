import { describe, expect, it, vi } from 'vitest';

import { ApiError, createHttpClient } from '../src/repos/http/client';
import { createHttpAdminRepo } from '../src/repos/http/adminRepo';

/**
 * The Overview's HTTP repository against the server's real response shapes
 * (`packages/server/src/http/routes/admin.ts`, `routes/account.ts`, `services/admin/*.ts`).
 * Synthetic records only.
 */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
/** `envelope()` in `server/src/http/errors.ts`. */
const failure = (status: number, code: string, message: string) =>
  json(status, { error: { code, message, details: null, request_id: 'req_1' } });

/** A server that answers `METHOD /path` (under /api/v1) from a table, and records each request. */
function server(routes: Record<string, () => Response>) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(String(input));
    const answer = routes[`${init?.method ?? 'GET'} ${url.pathname.replace('/api/v1', '')}`];
    return answer ? answer() : failure(404, 'NOT_FOUND', 'That resource does not exist.');
  });
  const repo = createHttpAdminRepo(
    createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch }),
  );
  const requests = () =>
    fetch.mock.calls.map(([input, init]) => ({ url: String(input), method: init?.method }));
  return { repo, requests };
}

const USER = '4b9e1c2d-7a3f-4e5b-9c8d-1f2e3a4b9c10';
const STAFF = '0d1c2b3a-4e5f-4a6b-8c7d-9e8f7a6b5c4d';

describe('me', () => {
  // `/admin/me` is built in the route itself: the role, and the permissions in `PERMISSIONS`
  // order that hold it. `/me` is `account.getUser`.
  const access = { role: 'curator', permissions: ['content.manage', 'analytics.read'] };
  const profile = {
    id: STAFF,
    email: 'marco@nextkin.test',
    firstName: 'Marco',
    lastName: 'Kowalski',
    emailVerified: true,
    createdAt: '2026-01-05T09:00:00.000Z',
  };

  it('joins the role and permissions with the staff member’s name', async () => {
    const { repo, requests } = server({
      'GET /admin/me': () => json(200, access),
      'GET /me': () => json(200, profile),
    });
    await expect(repo.me()).resolves.toEqual({
      userId: STAFF,
      name: 'Marco Kowalski',
      email: 'marco@nextkin.test',
      role: 'curator',
      permissions: ['content.manage', 'analytics.read'],
    });
    expect(
      requests()
        .map((r) => `${r.method} ${r.url}`)
        .sort(),
    ).toEqual(['GET http://api.test/api/v1/admin/me', 'GET http://api.test/api/v1/me']);
  });

  it('falls back to the email when the account has no name', async () => {
    const { repo } = server({
      'GET /admin/me': () => json(200, access),
      'GET /me': () => json(200, { ...profile, firstName: '', lastName: '' }),
    });
    expect((await repo.me()).name).toBe('marco@nextkin.test');
  });
});

describe('overview', () => {
  // `services/admin/overview.ts`: a platform with one day of activity, as the server answers it.
  const overview = {
    range: '7d',
    window: { from: '2026-10-30T00:00:00.000Z', to: '2026-11-05T12:00:00.000Z' },
    signups: { value: 2, delta: null, trend: [0, 0, 0, 0, 0, 0, 2] },
    activation: null,
    reliability: {
      key: 'reliability',
      value: 0.5,
      delta: null,
      target: 0.98,
      trend: [0.5],
      basis: { cohort: 2, hit: 1 },
    },
    conversion: null,
    generations: {
      kinds: [{ kind: 'resume', runs: 2, failed: 1 }],
      delta: null,
      p95Seconds: 41,
      days: [],
    },
    pipeline: {
      status: 'degraded',
      queueDepth: 0,
      oldestQueuedSeconds: null,
      queueState: 'normal',
      p95Seconds: 41,
      p95TargetSeconds: 180,
      slaMetRate: 0.5,
      slaTargetRate: 0.99,
    },
    aiCost: { totalUsd: 0, delta: null, stages: [], costPerResumeUsd: null },
    subscriptions: { activePro: 0, delta: null, newThisMonth: 0, revenue: [], monthlyShare: null },
    ats: { mean: null, delta: null, rubricVersion: 'v2', buckets: [] },
    providers: [],
  };

  it('asks /admin/overview for the window on screen', async () => {
    const { repo, requests } = server({ 'GET /admin/overview': () => json(200, overview) });
    await repo.overview('7d');
    expect(requests().map((r) => r.url)).toEqual([
      'http://api.test/api/v1/admin/overview?range=7d',
    ]);
  });

  it('keeps every unmeasured rate and unrecorded change unserved, never zero', async () => {
    const { repo } = server({ 'GET /admin/overview': () => json(200, overview) });
    const result = await repo.overview('7d');
    expect(result.kpis.map((kpi) => kpi.key)).toEqual(['signups', 'reliability']);
    expect(result.unmeasured).toEqual(['activation', 'conversion']);
    expect(result.kpis[0]!.delta).toBeNull();
    expect(result.pipeline).toMatchObject({ status: 'degraded', slaMetRate: 0.5 });
    expect(result.subscriptions).toMatchObject({ activePro: 0, revenue: [], delta: null });
    expect(result.ats).toMatchObject({ mean: null, rubricVersion: 'v2' });
    expect(result.providers).toEqual([]);
  });

  it('surfaces a refusal as the error it is', async () => {
    const { repo } = server({
      'GET /admin/overview': () => failure(403, 'FORBIDDEN', 'You do not have access to this.'),
    });
    await expect(repo.overview('30d')).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });
});

describe('queues', () => {
  // `technologies.reviewQueue`: the machine-seeded and pipeline-met candidates, and users' reports.
  const kbQueue = {
    candidates: [
      { name: 'Bun', occurrences: 41, status: 'pending', technologyId: null },
      {
        name: 'Hono',
        occurrences: 12,
        status: 'seeded',
        technologyId: 'f3e2d1c0-0000-4000-8000-000000000001',
      },
      { name: 'Valkey', occurrences: 3, status: 'pending', technologyId: null },
    ],
    reports: [
      {
        id: 'a1b2c3d4-0000-4000-8000-000000000002',
        kind: 'claim_dispute',
        subject: 'Next.js',
        reason: 'Release year looks wrong',
        createdAt: '2026-11-04T08:00:00.000Z',
      },
    ],
  };
  // `prompts.listPrompts`: per template, its versions newest first; `evaluated` on a version is
  // `eval_run_ref !== null`, a passing evaluation.
  const version = (n: number, status: string, evaluated: boolean) => ({
    id: `v-${n}-${status}`,
    version: n,
    status,
    evaluated,
    createdAt: '2026-11-01T10:00:00.000Z',
    body: { system: ['…'] },
  });
  const prompt = (name: string, versions: ReturnType<typeof version>[]) => ({
    name,
    stage: name.split('.')[0],
    description: null,
    evaluated: true,
    versions,
  });
  const prompts = {
    data: [
      // A draft with no eval yet: waiting.
      prompt('jd.extract', [version(3, 'draft', false), version(2, 'active', true)]),
      // Staged and passed: ready to publish, not waiting.
      prompt('resume.generate', [version(5, 'staged', true), version(4, 'active', true)]),
      // The newest of a staged and an older draft is the stage's draft: one waiting, not two.
      prompt('resume.revise', [
        version(7, 'staged', false),
        version(6, 'draft', false),
        version(5, 'active', true),
      ]),
      // A draft that already passed.
      prompt('cover.write', [version(4, 'draft', true), version(3, 'active', true)]),
      // No draft at all.
      prompt('assistant.classify', [version(2, 'active', true), version(1, 'archived', true)]),
    ],
  };

  it('counts the review queue and the drafts still waiting on an eval, as the Content pages do', async () => {
    const { repo, requests } = server({
      'GET /admin/kb/queue': () => json(200, kbQueue),
      'GET /admin/prompts': () => json(200, prompts),
    });
    await expect(repo.queues()).resolves.toEqual([
      { key: 'kbReview', count: 3, detail: 'Diffs waiting for approve or reject' },
      { key: 'promptDrafts', count: 2, detail: 'Need a passing eval to publish' },
    ]);
    expect(requests().map((r) => r.url)).toEqual(
      expect.arrayContaining([
        'http://api.test/api/v1/admin/kb/queue',
        'http://api.test/api/v1/admin/prompts',
      ]),
    );
  });

  it('adds the failure, deletion, report and provider queues from their areas', async () => {
    const { repo } = server({
      'GET /admin/kb/queue': () => json(200, kbQueue),
      'GET /admin/prompts': () => json(200, prompts),
      'GET /admin/providers': () =>
        json(200, {
          data: [
            { provider: 'adzuna', enabled: true, limits: null, keySet: true },
            { provider: 'jsearch', enabled: false, limits: null, keySet: false },
          ],
        }),
      'GET /admin/providers/stats': () =>
        json(200, { adzuna: { errorRate: 0.041 }, jsearch: { errorRate: 0.5 } }),
    });
    const queues = await repo.queues();
    // The paused provider isn't counted, however its calls went.
    expect(queues.find((q) => q.key === 'providerErrors')).toEqual({
      key: 'providerErrors',
      count: 1,
      detail: 'Adzuna at 4.1% errors today',
    });
  });

  it('shows a support agent no content queue, since both answer 403', async () => {
    const forbidden = () => failure(403, 'FORBIDDEN', 'You do not have access to this.');
    const { repo } = server({ 'GET /admin/kb/queue': forbidden, 'GET /admin/prompts': forbidden });
    await expect(repo.queues()).resolves.toEqual([]);
  });

  it('fails when a queue fails, rather than reading as all clear', async () => {
    const { repo } = server({
      'GET /admin/kb/queue': () => failure(500, 'INTERNAL', 'Something went wrong.'),
      'GET /admin/prompts': () => json(200, prompts),
    });
    const error = await repo.queues().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'INTERNAL', status: 500 });
  });
});

describe('activity', () => {
  // `audit.searchAudit`: newest first, `id` as a number, `before`/`after` as stored jsonb.
  const row = (id: number, fields: Record<string, unknown>) => ({
    id,
    actorUserId: STAFF,
    actorRole: 'support',
    action: 'user.password_reset',
    targetType: 'user',
    targetId: USER,
    before: null,
    after: null,
    reason: null,
    ip: '10.0.0.4',
    requestId: `req_${id}`,
    createdAt: `2026-11-05T10:${String(id).padStart(2, '0')}:00.000Z`,
    ...fields,
  });
  const audit = {
    data: [
      row(46, { action: 'user.password_reset' }),
      row(45, {
        actorRole: 'admin',
        action: 'user.content_read',
        targetType: 'resume',
        targetId: '9a8b7c6d-0000-4000-8000-00000000abcd',
        after: { userId: USER },
        reason: 'Ticket 2231: export layout broken',
      }),
      row(44, { actorRole: 'admin', action: 'user.suspend', reason: 'abuse: spam runs' }),
      row(43, {
        actorRole: 'curator',
        action: 'kb.update',
        targetType: 'technology',
        targetId: 'f3e2d1c0-0000-4000-8000-0000000037a2',
      }),
      row(42, {
        actorUserId: null,
        actorRole: 'super_admin',
        action: 'prompt.publish',
        targetType: 'prompt',
        targetId: 'v-14',
      }),
      row(41, { action: 'user.comp', reason: 'goodwill' }),
    ],
  };

  it('asks for the newest fifty and shows the newest five, masked by the screen', async () => {
    const { repo, requests } = server({ 'GET /admin/audit': () => json(200, audit) });
    const rows = await repo.activity('');
    // The audit rows, and the staff names that make them readable (toreview §171.13).
    expect(requests()).toEqual([
      { url: 'http://api.test/api/v1/admin/audit?limit=50', method: 'GET' },
      { url: 'http://api.test/api/v1/admin/staff/names', method: 'GET' },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['46', '45', '44', '43', '42']);
    expect(rows[0]).toEqual({
      id: '46',
      staff: { name: 'staff ···5c4d', role: 'support' },
      action: 'user.password_reset',
      target: { kind: 'user', ref: USER },
      reason: '',
      result: 'done',
      at: '2026-11-05T10:46:00.000Z',
    });
    // A content read targets the resume; the board's row names the user whose resume it is.
    expect(rows[1]).toMatchObject({
      target: { kind: 'user', ref: USER },
      result: 'audited_read',
      reason: 'Ticket 2231: export layout broken',
    });
    expect(rows[2]).toMatchObject({ result: 'suspended' });
    expect(rows[3]!.target).toEqual({
      kind: 'technology',
      ref: 'f3e2d1c0-0000-4000-8000-0000000037a2',
    });
    expect(rows[4]).toMatchObject({
      staff: { name: 'System', role: 'super_admin' },
      target: { kind: 'prompt', ref: 'v-14' },
    });
  });

  it('searches what came back: by role, action or target', async () => {
    const { repo } = server({ 'GET /admin/audit': () => json(200, audit) });
    expect((await repo.activity('curator')).map((r) => r.id)).toEqual(['43']);
    expect((await repo.activity('content_read')).map((r) => r.id)).toEqual(['45']);
    expect((await repo.activity('no such thing')).length).toBe(0);
  });

  it('is empty when the log is', async () => {
    const { repo } = server({ 'GET /admin/audit': () => json(200, { data: [] }) });
    await expect(repo.activity('')).resolves.toEqual([]);
  });
});
