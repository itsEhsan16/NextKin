import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { backendProfile, readyJd, runToEnd } from './fixtures/documents';
import { mobileLogin, registered, startHarness, type Harness } from './fixtures/authHarness';

/**
 * The shareable ATS report (ImBackendImplementationPlan P11-10; V2 §4.1): a shared report holds no
 * contact detail and no evidence text, shows no total without a JD, and stops working the moment it
 * is revoked. Through the API, and through the apps' `shareLink`.
 */
let h: Harness;
beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await h.close();
});

async function bearer(email: string) {
  const tokens = await mobileLogin(h, email);
  return { authorization: `Bearer ${tokens.accessToken}`, 'x-nextkin-client': 'mobile', 'content-type': 'application/json' };
}

describe('shared ATS reports (P11-10)', () => {
  it('shares a redacted snapshot, reads it publicly, and revokes it at once', async () => {
    const email = await registered(h);
    const headers = await bearer(email);
    const user = await h.db.withSystem('test: find the user', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow());
    // The documents fixture's profile and a built, JD-scored resume, on this signed-in user.
    await backendProfile(h.db, user.id);
    const jd = await readyJd(h.db, user.id, groundedModel);
    const built = await runToEnd(h.db, user.id, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);

    const created = await h.app.request(`/api/v1/resumes/${built.resumeId}/share`, { method: 'POST', headers, body: JSON.stringify({}) });
    expect(created.status).toBe(201);
    const { id, url } = (await created.json()) as { id: string; url: string };
    const token = url.split('/r/')[1]!;
    expect(token.length).toBeGreaterThanOrEqual(32);

    const shared = await h.app.request(`/api/v1/public/shared-reports/${token}`);
    expect(shared.status).toBe(200);
    expect(shared.headers.get('cache-control')).toContain('no-store');
    const raw = await shared.text();
    const report = JSON.parse(raw) as { total: number | null; targetTitle: string; targetCompany: string | null; requirements: unknown[]; method: { rubric: string } };
    expect(report.total).not.toBeNull();
    expect(report.targetTitle).toBe('Senior Backend Engineer');
    expect(report.targetCompany).toBeNull(); // the employer only when the user chooses to show it
    expect(report.requirements.length).toBeGreaterThan(0);
    expect(report.method.rubric).toBe('rubric-2');
    // No contact detail, no employer of the user's, no bullet text.
    expect(raw).not.toContain(email);
    for (const text of ['Lumen Pay', 'Cartwheel', 'settlement service', '2 million transactions']) expect(raw).not.toContain(text);

    const listed = (await (await h.app.request('/api/v1/shared-reports', { headers })).json()) as { data: { id: string; revokedAt: string | null }[] };
    expect(listed.data).toEqual([expect.objectContaining({ id, revokedAt: null })]);

    expect((await h.app.request(`/api/v1/shared-reports/${id}`, { method: 'DELETE', headers })).status).toBe(204);
    expect((await h.app.request(`/api/v1/public/shared-reports/${token}`)).status).toBe(404);
    // A wrong token looks exactly like a revoked one.
    expect((await h.app.request(`/api/v1/public/shared-reports/${'x'.repeat(32)}`)).status).toBe(404);
  }, 90_000);

  it('another user cannot revoke the link, and the apps’ shareLink returns a working one', async () => {
    const email = await registered(h);
    const headers = await bearer(email);
    const user = await h.db.withSystem('test: find the user', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow());
    await backendProfile(h.db, user.id);
    const built = await runToEnd(h.db, user.id, 'resume', { origin: 'build' }, groundedModel);

    const { createHttpResumesRepo } = await import('@nextkin/shared/repos/http/resumesRepo');
    const { createMockRepos } = await import('@nextkin/shared/repos');
    const { createMockStore } = await import('@nextkin/shared/repos/state');
    const { createHttpClient } = await import('@nextkin/shared/repos/http/client');
    const tokens = await mobileLogin(h, email);
    let stored = { ...tokens, expiresIn: 3600 };
    const http = createHttpClient({
      baseUrl: 'http://localhost:3000',
      client: 'mobile',
      tokens: { get: async () => stored, set: async (next) => void (next && (stored = next)) },
      fetch: (input, init) => h.app.request(String(input), init) as Promise<Response>,
    });
    const resumes = createHttpResumesRepo(http, { upload: async () => {} } as never, createMockRepos(createMockStore()).resumes);
    const url = await resumes.shareLink(built.resumeId!);
    expect(url).toMatch(/\/r\/[A-Za-z0-9_-]{32}$/);
    const token = url.split('/r/')[1]!;
    const report = (await (await h.app.request(`/api/v1/public/shared-reports/${token}`)).json()) as { total: number | null; requirements: unknown[] };
    // Built without a JD: no total and no requirement checklist (D-15).
    expect(report.total).toBeNull();
    expect(report.requirements).toEqual([]);

    const [own] = ((await (await h.app.request('/api/v1/shared-reports', { headers })).json()) as { data: { id: string }[] }).data;
    const other = await bearer(await registered(h));
    expect((await h.app.request(`/api/v1/shared-reports/${own!.id}`, { method: 'DELETE', headers: other })).status).toBe(404);
    expect((await h.app.request(`/api/v1/public/shared-reports/${token}`)).status).toBe(200);
  }, 90_000);
});
