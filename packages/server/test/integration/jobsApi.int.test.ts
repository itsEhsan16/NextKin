import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mobileLogin, registered, startHarness, type Harness } from './fixtures/authHarness';

/**
 * P11-11's done-when for jobs, through the shared client both apps run: search, counts, picks,
 * detail, similar, company, saving (idempotent, capped), a JD made from a listing, and applying,
 * which stays on the mock (D-05) from a copy of the server listing.
 */
let h: Harness;
beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await h.close();
});

describe('jobs over the apps’ HTTP repositories (P11-11)', () => {
  it('searches, saves, reads a listing’s JD and applies on the mock', async () => {
    const { createRepos } = await import('@nextkin/shared/repos/create');
    const { createMockRepos, PlanLockedError } = await import('@nextkin/shared/repos');
    const { createMockStore } = await import('@nextkin/shared/repos/state');
    const { adoptDocument, adoptJob } = await import('@nextkin/shared/repos/adopt');
    const { createHttpClient } = await import('@nextkin/shared/repos/http/client');
    const { EMPTY_JOB_FILTERS } = await import('@nextkin/shared/models/job');

    const email = await registered(h);
    const tokens = await mobileLogin(h, email);
    let stored = { ...tokens, expiresIn: 3600 };
    const http = createHttpClient({
      baseUrl: 'http://localhost:3000',
      client: 'mobile',
      tokens: { get: async () => stored, set: async (next) => void (next && (stored = next)) },
      fetch: (input, init) => h.app.request(String(input), init) as Promise<Response>,
    });
    const store = createMockStore();
    const { repos } = createRepos(
      { sources: { jobs: 'http', jd: 'http' }, http, adopt: (doc) => adoptDocument(store, doc), adoptJob: (job) => adoptJob(store, job) },
      createMockRepos(store),
    );

    // Search pages with a cursor; count agrees with the filters; lists repeat as query keys.
    const first = await repos.jobs.list(EMPTY_JOB_FILTERS);
    expect(first.items).toHaveLength(20);
    const second = await repos.jobs.list(EMPTY_JOB_FILTERS, first.nextCursor);
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
    const filters = { ...EMPTY_JOB_FILTERS, remote: ['remote' as const, 'hybrid' as const] };
    const filtered = await repos.jobs.list(filters);
    expect(filtered.items.every((j) => j.remote === 'remote' || j.remote === 'hybrid')).toBe(true);
    expect(await repos.jobs.count(filters)).toBeGreaterThanOrEqual(filtered.items.length);

    const job = first.items[0]!;
    expect((await repos.jobs.get(job.id)).title).toBe(job.title);
    expect(Array.isArray(await repos.jobs.listSimilar(job.id))).toBe(true);
    expect((await repos.jobs.listByCompany(job.company)).some((j) => j.id === job.id)).toBe(true);
    expect(Array.isArray(await repos.jobs.listPicks())).toBe(true);
    expect((await repos.jobs.listTodaysPicks()).length).toBeLessThanOrEqual(3);

    // Saving is idempotent and capped at 10 on Free; the 11th is a real PlanLockedError.
    expect((await repos.jobs.setSaved(job.id, true)).isSaved).toBe(true);
    expect((await repos.jobs.setSaved(job.id, true)).isSaved).toBe(true);
    for (const other of first.items.slice(1, 10)) await repos.jobs.setSaved(other.id, true);
    await expect(repos.jobs.setSaved(first.items[10]!.id, true)).rejects.toBeInstanceOf(PlanLockedError);
    expect((await repos.jobs.listSaved()).length).toBe(10);
    expect((await repos.jobs.setSaved(job.id, false)).isSaved).toBe(false);

    // A listing's JD is made on the server from the listing, at once, and reused.
    const draft = await repos.jd.forJob(job.id);
    expect(draft).toMatchObject({ source: 'job', status: 'ready', jobId: job.id, title: job.title });
    expect((await repos.jd.forJob(job.id)).id).toBe(draft.id);

    // Applying stays on the mock, from a copy of the server listing under its server id.
    const application = await repos.jobs.apply(job.id);
    expect(application.jobId).toBe(job.id);
    expect((await repos.jobs.listApplications()).some((a) => a.job.id === job.id)).toBe(true);
  }, 60_000);
});
