import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ContentNotServedError,
  EvalRequiredError,
  NotCertifiedError,
  SourceRequiredError,
} from '../src/models/adminContent';
import { createHttpAdminContentRepo } from '../src/repos/http/adminContentRepo';
import { ApiError, createHttpClient } from '../src/repos/http/client';
import { NotFoundError } from '../src/repos/state';

/**
 * The admin Content area's HTTP repository against the server's own response shapes (P12-03…
 * P12-05). Every fake response copies what the named service function returns, so a mismatch
 * here is a mismatch with `packages/server/src/http/routes/admin.ts`.
 */

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const envelope = (code: string, message: string, details: unknown = null) => ({
  error: { code, message, details, request_id: 'r-1' },
});
const path = (input: unknown) => {
  const url = new URL(String(input));
  return { url, route: url.pathname.replace(/^\/api\/v1/, '') };
};

type Handler = (url: URL, body: unknown) => unknown;

/** A fake API keyed `'METHOD /path'`: a value answers 200, a function answers per request. */
function api(routes: Record<string, unknown>) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const { url, route } = path(input);
    const key = `${init?.method ?? 'GET'} ${route}`;
    if (!(key in routes)) return json(404, envelope('NOT_FOUND', `No route ${key}`));
    const reply = routes[key];
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const value = typeof reply === 'function' ? (reply as Handler)(url, body) : reply;
    return value instanceof Response ? value : json(200, value);
  });
  const http = createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch });
  /** Every request as `METHOD /path?query`, with its JSON body. */
  const calls = () =>
    fetch.mock.calls.map(([input, init]) => {
      const { url, route } = path(input);
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      return { request: `${init?.method ?? 'GET'} ${route}${url.search}`, body };
    });
  return { repo: createHttpAdminContentRepo(http), calls };
}

const requests = (calls: () => { request: string }[]) => calls().map((c) => c.request);

afterEach(() => {
  vi.useRealTimers();
});

// --- Prompts -------------------------------------------------------------------------------------

/** One version as `listPrompts` (services/admin/prompts.ts) returns it. */
const v = (n: number, status: string, evaluated = false, system = [`Rule for v${n}.`]) => ({
  id: `pv-${n}`,
  version: n,
  status,
  evaluated,
  createdAt: `2026-11-0${n}T10:42:00.000Z`,
  body: { system },
});

/** `listPrompts`: one entry per template, by name, versions newest first. */
const PROMPTS = {
  data: [
    {
      name: 'jd.extract',
      stage: 'jd_extract',
      description: 'Read a job description into typed fields.',
      evaluated: true,
      // Rolled back from v4 to v2: v3 is a save superseded by the v4 that went live.
      versions: [v(4, 'archived'), v(3, 'draft'), v(2, 'active'), v(1, 'archived')],
    },
    {
      name: 'resume.revise',
      stage: 'resume_revise',
      description: 'Revise a resume within its claim ledger.',
      evaluated: true,
      versions: [
        v(6, 'draft', false, ['Keep every claim the ledger holds.', 'Never add a number.']),
        v(5, 'draft'),
        v(4, 'active', false, ['Keep every claim the ledger holds.']),
        v(3, 'draft'),
        v(2, 'archived'),
        v(1, 'archived'),
      ],
    },
    {
      name: 'assistant.classify',
      stage: 'assistant_classify',
      description: null,
      evaluated: true,
      versions: [v(2, 'staged', true), v(1, 'active')],
    },
  ],
};

/** `GET /admin/prompts/figures` (services/admin/contentCatalog.ts) with nothing measured. */
const window = (evalPassRate: number | null, costPerResumeUsd: number | null) => ({
  evalPassRate,
  evaluations: evalPassRate === null ? 0 : 10,
  costPerResumeUsd,
  resumeRuns: costPerResumeUsd === null ? 0 : 40,
});
const NO_FIGURES = { current: window(null, null), previous: window(null, null) };

describe('prompts', () => {
  it('lists each stage with its live version and its open draft, and nothing it can’t serve', async () => {
    const { repo, calls } = api({
      'GET /admin/prompts': PROMPTS,
      'GET /admin/prompts/figures': NO_FIGURES,
    });
    const overview = await repo.listPrompts();
    expect(requests(calls).sort()).toEqual(['GET /admin/prompts', 'GET /admin/prompts/figures']);
    expect(overview).toMatchObject({ evalPassRate: null, costPerResume: null });
    const [extract, revise, classify] = overview.stages;
    // A draft older than a version that has been live was superseded: no open draft.
    expect(extract).toMatchObject({ name: 'jd.extract', activeVersion: 2, draft: null });
    expect(revise).toEqual({
      name: 'resume.revise',
      description: 'Revise a resume within its claim ledger.',
      activeVersion: 4,
      draft: { version: 6, state: 'awaiting_eval' },
      lastEval: null,
      threshold: null,
      costPerRunUsd: null,
      p95Seconds: null,
      updatedAt: '2026-11-06T10:42:00.000Z',
      updatedBy: null,
    });
    // A staged draft with a passing eval is ready; a missing description is empty, not invented.
    expect(classify).toMatchObject({ description: '', draft: { version: 2, state: 'ready' } });
  });

  it('reads the thirty-day figures, with the change from the thirty days before where measured', async () => {
    const both = api({
      'GET /admin/prompts': PROMPTS,
      'GET /admin/prompts/figures': { current: window(0.9, 0.061), previous: window(0.85, 0.065) },
    });
    expect(await both.repo.listPrompts()).toMatchObject({
      evalPassRate: { rate: 0.9, deltaPercent: 5 },
      costPerResume: { usd: 0.061, previousUsd: 0.065, previousLabel: 'the 30 days before' },
    });
    // A first window has nothing to compare with: the figure alone, no invented change.
    const first = api({
      'GET /admin/prompts': PROMPTS,
      'GET /admin/prompts/figures': { current: window(1, 0.05), previous: window(null, null) },
    });
    expect(await first.repo.listPrompts()).toMatchObject({
      evalPassRate: { rate: 1, deltaPercent: null },
      costPerResume: { usd: 0.05, previousUsd: null, previousLabel: null },
    });
  });

  it('opens a prompt with the live version, the earlier live ones and the open draft', async () => {
    const { repo } = api({ 'GET /admin/prompts': PROMPTS });
    const detail = await repo.getPrompt('resume.revise');
    expect(detail.versions.map((x) => [x.version, x.status])).toEqual([
      [6, 'draft'],
      [4, 'active'],
      [2, 'retired'],
      [1, 'retired'],
    ]);
    expect(detail).toMatchObject({
      activeVersion: 4,
      activeSince: '2026-11-04T10:42:00.000Z',
      draft: { version: 6, author: null },
      editor: {
        system: 'Keep every claim the ledger holds.\nNever add a number.',
        user: '',
        schema: '',
        settings: '',
      },
      activeEditor: { system: 'Keep every claim the ledger holds.' },
      stage: null,
      eval: null,
      sandbox: null,
    });
    await expect(repo.getPrompt('no.such')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('starts a draft from the live version’s paragraphs, or returns the one already open', async () => {
    let drafted = false;
    const { repo, calls } = api({
      'GET /admin/prompts': () => ({
        data: [
          {
            ...PROMPTS.data[0]!,
            versions: [...(drafted ? [v(5, 'draft')] : []), ...PROMPTS.data[0]!.versions],
          },
          PROMPTS.data[1]!,
        ],
      }),
      // draftPrompt: the new version, 201.
      'POST /admin/prompts/jd.extract/versions': (_url: URL, body: unknown) => {
        drafted = true;
        return json(201, { id: 'pv-5', templateId: 't-1', version: 5, body });
      },
    });
    const opened = await repo.createPromptDraft('resume.revise');
    expect(opened.draft).toEqual({ version: 6, author: null });
    expect(requests(calls)).toEqual(['GET /admin/prompts']);

    const started = await repo.createPromptDraft('jd.extract');
    expect(calls()[2]).toEqual({
      request: 'POST /admin/prompts/jd.extract/versions',
      body: { system: ['Rule for v2.'] },
    });
    expect(started.draft).toEqual({ version: 5, author: null });
  });

  it('saves the system prompt as a new version of paragraphs; other parts are refused', async () => {
    const { repo, calls } = api({
      'GET /admin/prompts': PROMPTS,
      'POST /admin/prompts/resume.revise/versions': () => json(201, {}),
    });
    await repo.savePromptDraft('resume.revise', {
      tab: 'system',
      text: 'Keep every claim.\n\n   \nNever add a number.\r\n',
    });
    expect(calls().at(-2)).toEqual({
      request: 'POST /admin/prompts/resume.revise/versions',
      body: { system: ['Keep every claim.', 'Never add a number.'] },
    });

    // Only blank lines differ from the open draft: no new version.
    const before = calls().length;
    await repo.savePromptDraft('resume.revise', {
      tab: 'system',
      text: 'Keep every claim the ledger holds.\n\nNever add a number.',
    });
    expect(requests(calls).slice(before)).toEqual(['GET /admin/prompts']);

    const sent = calls().length;
    await expect(
      repo.savePromptDraft('resume.revise', { tab: 'system', text: ' \n' }),
    ).rejects.toThrow(/can’t be empty/);
    const many = Array.from({ length: 21 }, (_, i) => `Rule ${i + 1}.`).join('\n');
    await expect(
      repo.savePromptDraft('resume.revise', { tab: 'system', text: many }),
    ).rejects.toThrow(/at most 20 paragraphs; this one has 21/);
    await expect(
      repo.savePromptDraft('resume.revise', { tab: 'user', text: 'x' }),
    ).rejects.toBeInstanceOf(ContentNotServedError);
    await expect(repo.savePromptDraft('resume.revise', { note: 'Why' })).rejects.toBeInstanceOf(
      ContentNotServedError,
    );
    expect(calls()).toHaveLength(sent);
  });

  it('publishes an evaluated draft by staging then activating it', async () => {
    const { repo, calls } = api({
      'GET /admin/prompts': {
        data: [{ ...PROMPTS.data[1]!, versions: [v(6, 'draft', true), v(4, 'active')] }],
      },
      'POST /admin/prompts/versions/pv-6/stage': () => new Response(null, { status: 204 }),
      'POST /admin/prompts/versions/pv-6/activate': () => new Response(null, { status: 204 }),
    });
    await repo.publishPrompt('resume.revise', 6);
    expect(requests(calls)).toEqual([
      'GET /admin/prompts',
      'POST /admin/prompts/versions/pv-6/stage',
      'POST /admin/prompts/versions/pv-6/activate',
      'GET /admin/prompts',
    ]);
  });

  it('refuses a draft without a passing eval before staging it, and maps the server’s refusal', async () => {
    const { repo, calls } = api({ 'GET /admin/prompts': PROMPTS });
    await expect(repo.publishPrompt('resume.revise', 6)).rejects.toBeInstanceOf(EvalRequiredError);
    expect(requests(calls)).toEqual(['GET /admin/prompts']);

    // activatePrompt: a staged version without a passing eval is a CONFLICT with a reason.
    const refused = api({
      'GET /admin/prompts': PROMPTS,
      'POST /admin/prompts/versions/pv-2/activate': () =>
        json(
          409,
          envelope('CONFLICT', 'This version has no passing evaluation. Evaluate it first.', {
            reason: 'eval_required',
          }),
        ),
    });
    await expect(refused.repo.publishPrompt('assistant.classify', 2)).rejects.toBeInstanceOf(
      EvalRequiredError,
    );
    // Already staged: only activated.
    expect(requests(refused.calls)).toEqual([
      'GET /admin/prompts',
      'POST /admin/prompts/versions/pv-2/activate',
    ]);
  });

  it('rolls back only to a version that was live', async () => {
    const { repo, calls } = api({
      'GET /admin/prompts': PROMPTS,
      'POST /admin/prompts/versions/pv-2/activate': () => new Response(null, { status: 204 }),
    });
    await repo.rollbackPrompt('resume.revise', 2);
    expect(requests(calls)).toContain('POST /admin/prompts/versions/pv-2/activate');
    await expect(repo.rollbackPrompt('resume.revise', 3)).rejects.toThrow(/never live/);
    expect(requests(calls).filter((r) => r.startsWith('POST'))).toHaveLength(1);
    await expect(
      repo.runSandbox('resume.revise', { resumeId: 'r', jobId: 'j' }),
    ).resolves.toBeNull();
  });
});

describe('prompt evals', () => {
  /** evaluatePrompt answers 202 `{ id, status, createdAt }`; getEvaluation is polled until it's done. */
  const evalApi = (finished: Record<string, unknown> | null) =>
    api({
      'GET /admin/prompts': PROMPTS,
      'POST /admin/prompts/versions/pv-2/evaluate': () =>
        json(202, { id: 'ev-1', status: 'running', createdAt: '2026-11-05T10:42:00.000Z' }),
      'GET /admin/prompts/evaluations/ev-1': {
        id: 'ev-1',
        versionId: 'pv-2',
        status: 'running',
        mode: null,
        report: null,
        createdAt: '2026-11-05T10:42:00.000Z',
        finishedAt: null,
        ...(finished ? { finishedAt: '2026-11-05T10:44:00.000Z', ...finished } : {}),
      },
    });

  const run = async (finished: Record<string, unknown> | null, wait = 1500) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const harness = evalApi(finished);
    const result = harness.repo.evaluatePrompt('assistant.classify', 2).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(wait);
    return { result: await result, calls: harness.calls };
  };

  it('a live scope-set run is the score against its bar (runTemplateEval, assistant.classify)', async () => {
    const { result, calls } = await run({
      status: 'passed',
      mode: 'live',
      report: {
        total: 40,
        correct: 39,
        accuracy: 0.975,
        falseRefusals: [],
        falseAccepts: ['x'],
        bar: 0.95,
      },
    });
    expect(result).toEqual({
      version: 2,
      at: '2026-11-05T10:44:00.000Z',
      score: 0.975,
      threshold: 0.95,
      passed: true,
      cases: 40,
      baseline: null,
      checks: [],
    });
    expect(requests(calls)).toEqual([
      'GET /admin/prompts',
      'POST /admin/prompts/versions/pv-2/evaluate',
      'GET /admin/prompts/evaluations/ev-1',
    ]);
  });

  it('a verdict with no measured score is told in words, never as a made-up figure', async () => {
    const golden = { totals: { anachronisms: 0 }, golden: 'golden-3' };
    const reference = await run({
      status: 'passed',
      mode: 'reference',
      report: { ...golden, failures: [] },
    });
    expect(reference.result).toBeInstanceOf(Error);
    expect((reference.result as Error).message).toMatch(
      /v2 passed its eval on the reference model.*no single score/,
    );

    const gate = await run({
      status: 'failed',
      mode: 'live',
      report: { ...golden, failures: ['2 anachronisms (bar 0)', 'revision rate 25% (bar 20%)'] },
    });
    expect((gate.result as Error).message).toBe(
      'v2 didn’t pass its eval: 2 anachronisms (bar 0); revision rate 25% (bar 20%)',
    );

    const message = 'No evaluation covers interview.write yet, so it cannot be published.';
    const unsupported = await run({ status: 'unsupported', mode: null, report: { message } });
    expect((unsupported.result as Error).message).toBe(message);
  });

  it('an eval still running after 30 s says so instead of failing it', async () => {
    const { result, calls } = await run(null, 30_000);
    expect((result as Error).message).toMatch(/still running/);
    expect(requests(calls).filter((r) => r.includes('/evaluations/'))).toHaveLength(20);
  });
});

// --- The Technology KB ---------------------------------------------------------------------------

/** One `technologies` row as `listTechnologies` returns it (`selectAll()`). */
const tech = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  slug: name.toLowerCase(),
  category: 'Frontend framework',
  aliases: [],
  release_year: null,
  safe_usage_year: null,
  enterprise_adoption_year: null,
  latest_version: null,
  status: 'active',
  review_status: 'published',
  source_citation: null,
  dataset_version: 1,
  created_at: '2026-10-01T09:00:00.000Z',
  updated_at: '2026-11-02T09:00:00.000Z',
  ...over,
});

const REACT = tech('t-react', 'React', {
  aliases: ['reactjs'],
  release_year: 2013,
  latest_version: '19.0',
  source_citation: 'https://react.dev/blog',
});
// Seeded from the queue, with a cited source: waiting for review.
const BUN = tech('t-bun', 'Bun', {
  category: 'JavaScript runtime',
  aliases: ['bunjs'],
  release_year: 2023,
  latest_version: '1.1',
  review_status: 'llm_seeded',
  source_citation: 'https://bun.sh/blog/bun-v1.0',
  created_at: '2026-11-04T09:00:00.000Z',
});
// The engines' starter KB: a year and no source.
const GO = tech('t-go', 'Go', {
  category: 'Language',
  release_year: 2009,
  review_status: 'llm_seeded',
});
// Added by staff: reviewed, not yet published.
const DENO = tech('t-deno', 'Deno', {
  category: 'JavaScript runtime',
  review_status: 'admin_reviewed',
});
// Seeded, then approved: its queue row stays `seeded`.
const K8S = tech('t-k8s', 'Kubernetes', { category: 'Orchestration' });
const ROWS = [BUN, DENO, GO, K8S, REACT];

/** listTechnologies filters by `status` and by `q` on the name, ordered by name. */
const technologies =
  (rows = ROWS) =>
  (url: URL) => {
    const status = url.searchParams.get('status');
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    return {
      data: rows.filter(
        (t) => (!status || t.review_status === status) && t.name.toLowerCase().includes(q),
      ),
    };
  };

/** reviewQueue: pending and seeded names, most-seen first, then open reports. */
const QUEUE = {
  candidates: [
    { name: 'Kubernetes', occurrences: 41, status: 'seeded', technologyId: 't-k8s' },
    { name: 'Bun', occurrences: 12, status: 'seeded', technologyId: 't-bun' },
    { name: 'Zig', occurrences: 1, status: 'pending', technologyId: null },
  ],
  reports: [
    {
      id: 'f-1',
      kind: 'validation_flag',
      subject: { technology: 'Next.js', verdict: { kind: 'anachronism' } },
      reason: 'Next.js 15.1 shipped in December.',
      createdAt: '2026-11-03T08:00:00.000Z',
    },
  ],
};

/** `GET /admin/kb/stats` (services/admin/contentCatalog.ts): exact counts. */
const KB_STATS = { total: 5, added30d: 2, inReview: 2 };

const kbApi = (extra: Record<string, unknown> = {}) =>
  api({
    'GET /admin/technologies': technologies(),
    'GET /admin/kb/queue': QUEUE,
    'GET /admin/kb/stats': KB_STATS,
    ...extra,
  });

describe('technology KB', () => {
  it('maps a row: a year as the date, the source, the dataset, and the review state', async () => {
    const { repo, calls } = kbApi();
    const page = await repo.listTechnologies({
      tab: 'all',
      query: '  re ',
      page: 1,
      dataset: null,
    });
    expect(requests(calls)).toEqual(['GET /admin/technologies?q=re']);
    expect(page).toEqual({
      rows: [
        {
          id: 't-react',
          name: 'React',
          category: 'Frontend framework',
          aliases: ['reactjs'],
          latestVersion: '19.0',
          releaseDate: '2013',
          source: 'cited',
          sourceUrl: 'https://react.dev/blog',
          dataset: 'v1',
          updatedAt: '2026-11-02T09:00:00.000Z',
          updatedBy: '—',
          status: 'published',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    const all = await repo.listTechnologies({ tab: 'all', query: '', page: 1, dataset: null });
    expect(all.rows.find((t) => t.name === 'Go')).toMatchObject({
      status: 'needs_source',
      source: 'missing',
    });
    expect(
      (await repo.listTechnologies({ tab: 'all', query: '', page: 1, dataset: 'v2' })).total,
    ).toBe(0);
  });

  it('the review tab lists every entry not yet published; reports and imports aren’t served', async () => {
    const { repo, calls } = kbApi();
    const review = await repo.listTechnologies({
      tab: 'review',
      query: '',
      page: 1,
      dataset: null,
    });
    expect(requests(calls)).toEqual([
      'GET /admin/technologies?status=llm_seeded',
      'GET /admin/technologies?status=admin_reviewed',
    ]);
    // Go has a year with no source: it needs a source rather than a review.
    expect(review.rows.map((t) => t.name)).toEqual(['Bun', 'Deno']);
    for (const tab of ['reports', 'imports'] as const) {
      expect(await repo.listTechnologies({ tab, query: '', page: 1, dataset: null })).toEqual({
        rows: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });
    }
    expect(calls()).toHaveLength(2);
  });

  it('pages the served list ten at a time', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      tech(`t-${i}`, `Tech ${String(i).padStart(2, '0')}`),
    );
    const { repo } = api({ 'GET /admin/technologies': technologies(many) });
    const second = await repo.listTechnologies({ tab: 'all', query: '', page: 2, dataset: null });
    expect(second).toMatchObject({ total: 12, page: 2, pageSize: 10 });
    expect(second.rows.map((t) => t.name)).toEqual(['Tech 10', 'Tech 11']);
  });

  it('counts what is waiting: unreviewed seeded candidates and open reports', async () => {
    const { repo, calls } = kbApi();
    expect(await repo.kbStats()).toEqual({
      technologies: { total: 5, added30d: 2 },
      // Bun (a seeded candidate) and Deno (reviewed, not yet published) wait to be published.
      review: { total: 3, fromImports: null, staffEdits: null },
      reports: { total: 1, dates: null, aliases: null },
      dataset: null,
      tabs: { all: 5, review: 2, reports: null, imports: null },
    });
    expect(requests(calls).sort()).toEqual([
      'GET /admin/kb/queue',
      'GET /admin/kb/stats',
      'GET /admin/technologies?status=admin_reviewed',
      'GET /admin/technologies?status=llm_seeded',
    ]);
  });

  it('counts every entry from the server, not the length of a capped list', async () => {
    const capped = Array.from({ length: 500 }, (_, i) => tech(`t-${i}`, `Tech ${i}`));
    const { repo } = api({
      'GET /admin/technologies': (url: URL) => ({
        data: url.searchParams.get('status') ? [] : capped,
      }),
      'GET /admin/kb/queue': { candidates: [], reports: [] },
      'GET /admin/kb/stats': { total: 812, added30d: 0, inReview: 0 },
    });
    expect((await repo.kbStats()).tabs.all).toBe(812);
    expect((await repo.kbStats()).technologies).toEqual({ total: 812, added30d: 0 });
  });

  it('the queue shows each waiting candidate’s proposed values and each report on its own', async () => {
    const { repo, calls } = kbApi();
    const [bun, deno, report, ...rest] = await repo.kbQueue();
    expect(requests(calls).sort()).toEqual([
      'GET /admin/kb/queue',
      'GET /admin/technologies?status=admin_reviewed',
      'GET /admin/technologies?status=llm_seeded',
    ]);
    // Kubernetes was approved since, and Zig has no entry yet: neither is waiting.
    expect(rest).toEqual([]);
    expect(bun).toEqual({
      id: 't-bun',
      title: 'Bun · new technology',
      kind: 'new',
      origin: 'import',
      originLabel: 'Seeded candidate · seen 12 times',
      at: '2026-11-04T09:00:00.000Z',
      detail: {
        heading: 'Bun — new technology',
        technology: 'Bun · JavaScript runtime',
        proposedBy: 'Seeded by the model from resume validation',
        resumesAffected: '12 occurrences · aggregate count',
        targetDataset: 'v1',
        fields: [
          { field: 'Name', from: null, to: 'Bun' },
          { field: 'Category', from: null, to: 'JavaScript runtime' },
          { field: 'Aliases', from: null, to: 'bunjs' },
          { field: 'Latest version', from: null, to: '1.1' },
          { field: 'Release date', from: null, to: '2023' },
        ],
        source: {
          url: 'https://bun.sh/blog/bun-v1.0',
          cited: true,
          note: 'Cited when the entry was seeded',
        },
        reports: [],
      },
    });
    // Staff-added entries land reviewed; only the queue's Approve publishes them.
    expect(deno).toEqual({
      id: 't-deno',
      title: 'Deno · awaiting publish',
      kind: 'new',
      origin: 'staff_edit',
      originLabel: 'Reviewed · not yet published',
      at: '2026-11-02T09:00:00.000Z',
      detail: {
        heading: 'Deno — awaiting publish',
        technology: 'Deno · JavaScript runtime',
        proposedBy: 'Staff (added, imported or approved)',
        resumesAffected: '—',
        targetDataset: 'v1',
        fields: [
          { field: 'Name', from: null, to: 'Deno' },
          { field: 'Category', from: null, to: 'JavaScript runtime' },
        ],
        source: null,
        reports: [],
      },
    });
    expect(report).toMatchObject({
      id: 'report:f-1',
      title: 'Validation flagged · user report',
      kind: 'report',
      origin: 'user_report',
      at: '2026-11-03T08:00:00.000Z',
      detail: {
        technology: 'technology: Next.js',
        fields: [],
        source: null,
        reports: [
          {
            id: 'f-1',
            title: 'Validation flagged',
            body: 'Next.js 15.1 shipped in December.',
            at: '2026-11-03T08:00:00.000Z',
            origin: 'user report',
          },
        ],
      },
    });
    const empty = api({
      'GET /admin/technologies': { data: [] },
      'GET /admin/kb/queue': { candidates: [], reports: [] },
    });
    expect(await empty.repo.kbQueue()).toEqual([]);
  });

  it('looks up the candidates a capped list didn’t reach', async () => {
    const filler = Array.from({ length: 500 }, (_, i) =>
      tech(`t-f${i}`, `Aaa ${i}`, { review_status: 'llm_seeded' }),
    );
    const { repo, calls } = api({
      'GET /admin/technologies': (url: URL) => ({
        data:
          url.searchParams.get('status') !== 'llm_seeded'
            ? []
            : url.searchParams.get('q') === 'Bun'
              ? [BUN]
              : filler,
      }),
      'GET /admin/kb/queue': { candidates: [QUEUE.candidates[1]], reports: [] },
    });
    expect((await repo.kbQueue()).map((c) => c.id)).toEqual(['t-bun']);
    expect(requests(calls)).toContain('GET /admin/technologies?status=llm_seeded&q=Bun');
  });

  it('approving publishes; a date without a cited source is refused; reports can’t be settled', async () => {
    const { repo, calls } = kbApi({
      // reviewTechnology: the updated row (approve, publish) or null (reject).
      'POST /admin/technologies/t-bun/review': (_url: URL, body: unknown) =>
        (body as { decision: string }).decision === 'reject'
          ? null
          : { ...BUN, review_status: 'published' },
      'POST /admin/technologies/t-go/review': () =>
        json(
          400,
          envelope(
            'VALIDATION_FAILED',
            'Add a cited source for the release year before approving.',
            [{ path: 'sourceCitation', message: 'a reviewed date needs a cited source' }],
          ),
        ),
    });
    await repo.decideChange('t-bun', 'approve');
    await repo.decideChange('t-bun', 'reject');
    expect(calls().map((c) => c.body)).toEqual([{ decision: 'publish' }, { decision: 'reject' }]);
    await expect(repo.decideChange('t-go', 'approve')).rejects.toBeInstanceOf(SourceRequiredError);
    // The review words every refusal as the source one; an issue elsewhere stays the server's.
    const other = kbApi({
      'POST /admin/technologies/t-go/review': () =>
        json(
          400,
          envelope(
            'VALIDATION_FAILED',
            'Add a cited source for the release year before approving.',
            [{ path: 'safeUsageYear', message: 'cannot be before the release year' }],
          ),
        ),
    });
    const refused = await other.repo.decideChange('t-go', 'approve').catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ApiError);
    expect(refused).not.toBeInstanceOf(SourceRequiredError);
    await expect(repo.decideChange('report:f-1', 'approve')).rejects.toBeInstanceOf(
      ContentNotServedError,
    );
    await expect(repo.editChange('t-bun', [{ field: 'Name', to: 'Bun' }])).rejects.toBeInstanceOf(
      ContentNotServedError,
    );
    expect(calls()).toHaveLength(3);
  });

  it('saves an entry with the server’s field names, a year and a URL', async () => {
    const { repo, calls } = kbApi({
      // createTechnology: the inserted row (`toValues`), 201; staff entries default to reviewed.
      'POST /admin/technologies': (_url: URL, body: unknown) => {
        const input = body as Record<string, unknown>;
        return json(
          201,
          tech('t-new', String(input.name), {
            category: input.category,
            aliases: input.aliases,
            latest_version: input.latestVersion,
            release_year: input.releaseYear,
            source_citation: input.sourceCitation,
            review_status: 'admin_reviewed',
          }),
        );
      },
      'PATCH /admin/technologies/t-deno': () => ({ ...DENO, latest_version: '2.1' }),
    });
    const saved = await repo.saveTechnology({
      name: 'Hono',
      category: 'Web framework',
      aliases: ['honojs'],
      latestVersion: '4.6',
      releaseDate: '2021-12-15T12:00:00.000Z',
      sourceUrl: 'hono.dev/docs',
    });
    expect(calls()[0]).toEqual({
      request: 'POST /admin/technologies',
      body: {
        name: 'Hono',
        category: 'Web framework',
        aliases: ['honojs'],
        latestVersion: '4.6',
        releaseYear: 2021,
        sourceCitation: 'https://hono.dev/docs',
      },
    });
    expect(saved).toMatchObject({ id: 't-new', releaseDate: '2021', status: 'in_review' });

    const edited = await repo.saveTechnology(
      {
        name: 'Deno',
        category: 'JavaScript runtime',
        aliases: [],
        latestVersion: '2.1',
        releaseDate: null,
        sourceUrl: null,
      },
      't-deno',
    );
    expect(calls()[1]).toMatchObject({
      request: 'PATCH /admin/technologies/t-deno',
      body: { releaseYear: null, sourceCitation: null },
    });
    expect(edited.latestVersion).toBe('2.1');

    // Blank fields from the dialog go as nothing, not as values the server would refuse or keep.
    await repo.saveTechnology(
      {
        name: 'Deno',
        category: 'JavaScript runtime',
        aliases: ['deno', ' '],
        latestVersion: '  ',
        releaseDate: null,
        sourceUrl: null,
      },
      't-deno',
    );
    expect(calls()[2]?.body).toMatchObject({ aliases: ['deno'], latestVersion: null });
  });

  it('a save refused for its source is SourceRequiredError; any other refusal stays the server’s', async () => {
    const refuse = (
      issues: unknown,
      status = 400,
      code = 'VALIDATION_FAILED',
      message = 'The request is not valid.',
    ) =>
      api({ 'POST /admin/technologies': () => json(status, envelope(code, message, issues)) }).repo;
    const input = {
      name: 'Bun',
      category: 'Runtime',
      aliases: [],
      latestVersion: null,
      releaseDate: '2023-09-08',
      sourceUrl: null,
    };
    await expect(
      refuse([
        { path: 'sourceCitation', message: 'a reviewed date needs a cited source' },
      ]).saveTechnology(input),
    ).rejects.toBeInstanceOf(SourceRequiredError);
    const invalid = await refuse([{ path: 'sourceCitation', message: 'Invalid URL' }])
      .saveTechnology(input)
      .catch((e: unknown) => e);
    expect(invalid).toBeInstanceOf(ApiError);
    expect(invalid).not.toBeInstanceOf(SourceRequiredError);
    await expect(
      refuse(null, 409, 'CONFLICT', 'An entry with that name already exists.').saveTechnology(
        input,
      ),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'An entry with that name already exists.',
    });
  });

  it('imports the dialog’s CSV as the server’s JSON rows, and lists each failed row’s reasons', async () => {
    const { repo, calls } = kbApi({
      // importTechnologies: the slugs imported, and each failed row with its errors.
      'POST /admin/technologies/import': {
        imported: ['bun'],
        failed: [{ row: 2, errors: ['category: Invalid input', 'releaseYear: Invalid input'] }],
      },
    });
    const csv = [
      'name,category,aliases,latest_version,release_date,source',
      'Bun,JavaScript runtime,bunjs;bun.sh,1.1,2024-04-01,bun.sh/blog/bun-v1.1',
      '',
      '"Hono, the framework",,,4.6,April 2021,',
    ].join('\r\n');
    const result = await repo.importTechnologies({ format: 'csv', content: csv });
    expect(result).toEqual({
      imported: 1,
      failed: [{ row: 2, reason: 'category: Invalid input; releaseYear: Invalid input' }],
    });
    const body = calls()[0]!.body as { format: string; content: string };
    expect(body.format).toBe('json');
    expect(JSON.parse(body.content)).toEqual([
      {
        name: 'Bun',
        category: 'JavaScript runtime',
        aliases: ['bunjs', 'bun.sh'],
        latestVersion: '1.1',
        releaseYear: 2024,
        sourceCitation: 'https://bun.sh/blog/bun-v1.1',
      },
      // A date it can't read goes as is, for the server to list.
      { name: 'Hono, the framework', latestVersion: '4.6', releaseYear: 'April 2021' },
    ]);

    await repo.importTechnologies({
      format: 'json',
      content: JSON.stringify([
        {
          name: 'Bun',
          category: 'Runtime',
          release_date: '2024-04-01',
          source: 'https://bun.sh',
          aliases: ['bunjs'],
        },
      ]),
    });
    expect(JSON.parse((calls()[1]!.body as { content: string }).content)).toEqual([
      {
        name: 'Bun',
        category: 'Runtime',
        releaseYear: 2024,
        sourceCitation: 'https://bun.sh',
        aliases: ['bunjs'],
      },
    ]);
  });

  it('JSON the client can’t read goes unchanged, and the server’s refusal surfaces', async () => {
    const { repo, calls } = api({
      'POST /admin/technologies/import': () =>
        json(
          400,
          envelope('VALIDATION_FAILED', 'The file is not a JSON array of entries.', {
            content: 'a JSON array of entries',
          }),
        ),
    });
    await expect(
      repo.importTechnologies({ format: 'json', content: 'not json' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'The file is not a JSON array of entries.',
    });
    expect(calls()[0]!.body).toEqual({ format: 'json', content: 'not json' });
  });
});

/** One skill as `services/admin/contentSkills.ts` returns it. */
const skill = (id: string, name: string, aliases: string[], extra: Record<string, unknown> = {}) => ({
  id,
  name,
  aliases,
  parent: '',
  categoryId: 'cloud',
  usedIn: 3,
  editedAt: '2026-11-02T10:00:00.000Z',
  editedBy: 'Marco K.',
  ...extra,
});

const OVERVIEW = {
  stats: { skills: 2, added30d: 1, aliases: 3, perSkill: 1.5, merges: 1, unmapped: 1 },
  categories: [{ id: 'cloud', name: 'Cloud', count: 2 }],
  unmapped: [{ term: 'Pulumi', seenIn: 4 }],
  merges: [
    {
      id: 'merge:reactjs',
      alias: 'ReactJS',
      targetId: 's-react',
      target: 'React',
      seenIn: 9,
      firstSeen: '2026-10-12T00:00:00.000Z',
    },
  ],
  minPeople: 2,
};

describe('skills', () => {
  it('reads the overview as served: counts, categories, unmapped terms and merge suggestions', async () => {
    const { repo } = api({ 'GET /admin/skills/overview': OVERVIEW });
    expect(await repo.skillsOverview()).toEqual({
      stats: OVERVIEW.stats,
      categories: OVERVIEW.categories,
      unmapped: [{ term: 'Pulumi', seenIn: 4 }],
      merges: [
        {
          id: 'merge:reactjs',
          alias: 'ReactJS',
          target: 'React',
          seenIn: 9,
          firstSeen: '2026-10-12T00:00:00.000Z',
        },
      ],
    });
  });

  it('pages the list with the filters as query parameters, eight a page', async () => {
    const { repo, calls } = api({
      'GET /admin/skills': {
        data: [
          skill('s-k8s', 'Kubernetes', ['K8s']),
          skill('s-new', 'Pulumi', [], { categoryId: null, editedBy: null }),
        ],
        total: 9,
        page: 2,
        pageSize: 8,
      },
    });
    const page = await repo.listSkills({
      categoryId: 'cloud',
      filter: 'with',
      query: '  kube ',
      page: 2,
      sort: 'desc',
    });
    expect(requests(calls)).toEqual([
      'GET /admin/skills?category=cloud&aliases=with&q=kube&page=2&pageSize=8&sort=desc',
    ]);
    expect(page).toMatchObject({ total: 9, page: 2, pageSize: 8 });
    // No category reads as none; a seeded skill nobody edited says so.
    expect(page!.rows[1]).toMatchObject({ categoryId: '', editedBy: '—' });
  });

  it('writes go to their routes with the editor’s values', async () => {
    const { repo, calls } = api({
      'POST /admin/skills': skill('s-new', 'Pulumi', ['pulumi-cli']),
      'PUT /admin/skills/s-k8s/aliases': skill('s-k8s', 'Kubernetes', ['K8s', 'kube']),
      'POST /admin/skills/s-k8s/terms': skill('s-k8s', 'Kubernetes', ['K8s', 'kube', 'ArgoCD']),
      'POST /admin/skills/merges/resolve': () => new Response(null, { status: 204 }),
      'POST /admin/skill-categories': { id: 'iac', name: 'IaC', count: 0 },
    });
    expect(
      await repo.addSkill({ name: 'Pulumi', categoryId: '', parent: 'IaC', aliases: ['pulumi-cli'] }),
    ).toMatchObject({ id: 's-new', name: 'Pulumi' });
    expect((await repo.setAliases('s-k8s', ['K8s', 'kube'])).aliases).toEqual(['K8s', 'kube']);
    await repo.mapTerm('ArgoCD', 's-k8s');
    await repo.resolveMerge('merge:reactjs', 'dismiss');
    await repo.addCategory('IaC');
    expect(calls()).toEqual([
      {
        request: 'POST /admin/skills',
        // An empty category is none, not a category named ''.
        body: { name: 'Pulumi', categoryId: null, parent: 'IaC', aliases: ['pulumi-cli'] },
      },
      { request: 'PUT /admin/skills/s-k8s/aliases', body: { aliases: ['K8s', 'kube'] } },
      { request: 'POST /admin/skills/s-k8s/terms', body: { term: 'ArgoCD' } },
      {
        request: 'POST /admin/skills/merges/resolve',
        body: { id: 'merge:reactjs', decision: 'dismiss' },
      },
      { request: 'POST /admin/skill-categories', body: { name: 'IaC' } },
    ]);
  });

  it('a word already on another skill is the server’s refusal, unchanged', async () => {
    const { repo } = api({
      'PUT /admin/skills/s-k8s/aliases': () =>
        json(409, envelope('CONFLICT', 'Docker already uses one of those names.')),
    });
    await expect(repo.setAliases('s-k8s', ['docker'])).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Docker already uses one of those names.',
    });
  });
});

// --- Templates and the rubric --------------------------------------------------------------------

/** listTemplates (services/admin/catalog.ts), by slug. */
const TEMPLATES = {
  data: [
    {
      id: 'tp-1',
      slug: 'jake',
      name: 'Jake’s Resume',
      ats_safe: true,
      certified_at: '2026-10-20T10:00:00.000Z',
      status: 'published',
      updated_at: '2026-10-20T10:00:00.000Z',
    },
    {
      id: 'tp-2',
      slug: 'modern',
      name: 'Modern',
      ats_safe: true,
      certified_at: '2026-09-01T10:00:00.000Z',
      status: 'archived',
      updated_at: '2026-10-30T10:00:00.000Z',
    },
    {
      id: 'tp-3',
      slug: 'nextkin-classic',
      name: 'NextKin Classic',
      ats_safe: true,
      certified_at: null,
      status: 'draft',
      updated_at: '2026-11-01T10:00:00.000Z',
    },
  ],
};

/** `GET /admin/templates/usage` (services/admin/contentCatalog.ts): live resumes per template. */
const USAGE = {
  data: [
    { slug: 'jake', inUse: 41, basedOn: null },
    { slug: 'modern', inUse: 0, basedOn: null },
    { slug: 'nextkin-classic', inUse: 0, basedOn: 'modern' },
  ],
};

describe('templates', () => {
  it('lists templates: ATS-safe only once certified, usage served, no revision it can’t serve', async () => {
    const { repo } = api({ 'GET /admin/templates': TEMPLATES, 'GET /admin/templates/usage': USAGE });
    const [jake, modern, classic] = await repo.listTemplates();
    expect(jake).toEqual({
      slug: 'jake',
      name: 'Jake’s Resume',
      layout: 'jake',
      atsSafe: true,
      status: 'published',
      rev: 0,
      inUse: 41,
      editedAt: '2026-10-20T10:00:00.000Z',
      editedBy: '—',
      archivedAt: null,
    });
    expect(modern).toMatchObject({
      layout: 'modern',
      status: 'archived',
      archivedAt: '2026-10-30T10:00:00.000Z',
    });
    // Claimed ATS-safe by its design, but not certified: it can't be published yet. A copy draws as
    // the template it is based on.
    expect(classic).toMatchObject({ layout: 'modern', atsSafe: false, status: 'draft' });
    const none = api({ 'GET /admin/templates': { data: [] }, 'GET /admin/templates/usage': { data: [] } });
    expect(await none.repo.listTemplates()).toEqual([]);
  });

  it('sets a status, and an uncertified publish is NotCertifiedError by the template’s name', async () => {
    const { repo, calls } = api({
      'GET /admin/templates': TEMPLATES,
      'GET /admin/templates/usage': USAGE,
      // setTemplateStatus: `{ slug, status }`, or a CONFLICT naming the reason.
      'POST /admin/templates/jake/status': (_url: URL, body: unknown) => ({
        slug: 'jake',
        ...(body as object),
      }),
      'POST /admin/templates/nextkin-classic/status': () =>
        json(
          409,
          envelope(
            'CONFLICT',
            'This template has not passed the parse-back certification (Q-06), so it cannot be published.',
            { reason: 'not_certified' },
          ),
        ),
    });
    expect(await repo.setTemplateStatus('jake', 'draft')).toMatchObject({ slug: 'jake' });
    expect(calls()[0]).toEqual({
      request: 'POST /admin/templates/jake/status',
      body: { status: 'draft' },
    });
    const refused = await repo
      .setTemplateStatus('nextkin-classic', 'published')
      .catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(NotCertifiedError);
    expect((refused as Error).message).toMatch(/^NextKin Classic can't be published/);
  });

  it('creates a draft copy of a template, drawn as its base', async () => {
    const { repo, calls } = api({
      'POST /admin/templates': {
        id: 'tp-9',
        slug: 'jake-two-column',
        name: 'Jake two-column',
        ats_safe: true,
        certified_at: null,
        status: 'draft',
        updated_at: '2026-11-05T10:00:00.000Z',
        assets: { basedOn: 'jake' },
      },
    });
    expect(await repo.createTemplate({ name: 'Jake two-column', basedOn: 'jake' })).toMatchObject({
      slug: 'jake-two-column',
      layout: 'jake',
      atsSafe: false,
      status: 'draft',
      inUse: 0,
    });
    expect(calls()).toEqual([
      { request: 'POST /admin/templates', body: { name: 'Jake two-column', basedOn: 'jake' } },
    ]);
  });
});

/** listRubric (services/admin/catalog.ts), newest first: the seed's v1 and v2 (seed/reference.ts). */
const WEIGHTS = {
  keywords: 4000,
  timeline: 2000,
  sections: 1500,
  formatting: 1500,
  achievements: 1000,
};
const RUBRIC = {
  data: [
    {
      id: 'rv-2',
      version: 'v2',
      weights: WEIGHTS,
      bands: { strong: 8500, good: 7000, fair: 5500 },
      rationale:
        'v1 unchanged in weights.\n\nA JD asking more years than a technology has existed is measured against that ceiling.',
      evidence: 'Q-10 calibration set',
      is_current: true,
      created_at: '2026-10-03T09:00:00.000Z',
    },
    {
      id: 'rv-1',
      version: 'v1',
      weights: WEIGHTS,
      bands: { strong: 8500, good: 7000, fair: 5500 },
      rationale: 'Spec §7.8 published weights.',
      evidence: null,
      is_current: false,
      created_at: '2026-09-30T09:00:00.000Z',
    },
  ],
};

/** `GET /admin/rubric/rationale` with the seeded text, which no staff member has edited. */
const UNEDITED = {
  data: {
    version: 'v2',
    paragraphs: [] as string[],
    evidence: null,
    updatedBy: null as string | null,
    updatedAt: null as string | null,
  },
};

describe('rubric', () => {
  it('numbers the versions, reads the weights as basis points, and shows the current rationale', async () => {
    const { repo } = api({ 'GET /admin/rubric': RUBRIC, 'GET /admin/rubric/rationale': UNEDITED });
    const rubric = await repo.rubric();
    const [current, first] = rubric.versions;
    expect(current).toMatchObject({
      version: 2,
      status: 'active',
      author: '—',
      dateLabel: 'Oct 03, 2026',
      activeSince: null,
    });
    expect(first).toMatchObject({ version: 1, status: 'retired', dateLabel: 'Sep 30, 2026' });
    expect(current!.criteria[0]).toEqual({
      key: 'keywords',
      label: 'keywords',
      description: '',
      weight: 40,
      evidence: '',
    });
    expect(current!.criteria.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
    expect(rubric).toMatchObject({
      checklist: [],
      impact: null,
      rationale: {
        paragraphs: [
          'v1 unchanged in weights.',
          'A JD asking more years than a technology has existed is measured against that ceiling.',
        ],
        byline: '',
        evidence: [{ title: 'Q-10 calibration set', detail: '' }],
      },
    });
    // A new version ships with an engines release: there is no draft to publish here.
    await expect(repo.publishRubric(2)).rejects.toBeInstanceOf(ContentNotServedError);
  });

  it('saves the rationale against the current version, then shows who edited it', async () => {
    let edited = UNEDITED;
    const { repo, calls } = api({
      'GET /admin/rubric': RUBRIC,
      'GET /admin/rubric/rationale': () => edited,
      'PUT /admin/rubric/rationale': (_url: URL, body: unknown) => {
        edited = {
          data: {
            ...UNEDITED.data,
            paragraphs: (body as { paragraphs: string[] }).paragraphs,
            updatedBy: 'Ana L.',
            updatedAt: '2026-11-03T09:00:00.000Z',
          },
        };
        return edited;
      },
    });
    const after = await repo.saveRationale(['First.', 'Second.']);
    expect(calls().find((c) => c.request.startsWith('PUT'))).toEqual({
      request: 'PUT /admin/rubric/rationale',
      body: { version: 'v2', paragraphs: ['First.', 'Second.'] },
    });
    expect(after.rationale?.byline).toBe('Edited by Ana L. · Nov 03, 2026');
  });

  it('an empty rubric has no versions and no rationale; a failed read surfaces', async () => {
    const { repo } = api({ 'GET /admin/rubric': { data: [] }, 'GET /admin/rubric/rationale': { data: null } });
    expect(await repo.rubric()).toEqual({
      versions: [],
      checklist: [],
      rationale: null,
      impact: null,
    });
    const down = api({
      'GET /admin/rubric': () => json(500, envelope('INTERNAL', 'Something went wrong.')),
      'GET /admin/rubric/rationale': UNEDITED,
    });
    await expect(down.repo.rubric()).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});
