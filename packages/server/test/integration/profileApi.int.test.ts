// A zone east of UTC, where node-pg's default date parsing would shift a YYYY-MM-DD back a day.
process.env.TZ = 'Asia/Kolkata';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, ORIGIN, registered, startHarness, webLogin, withCookie, type Harness } from './fixtures/authHarness';

/**
 * Profile endpoints beyond the shared contract (ImBackendImplementationPlan P5-04): completeness is
 * derived from the data and nothing else, writes are conditional, entries are owner-scoped, dates
 * round-trip exactly, and every fact records its provenance.
 */
let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

type Json = Record<string, unknown> & { completeness: number; nextSteps: { id: string }[]; experiences: { provenance?: string; id: string; startDate: string; endDate?: string }[] };

async function signedIn() {
  const cookie = await webLogin(h, await registered(h));
  const send = async (path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
    const unsafe = (init.method ?? (init.body === undefined ? 'GET' : 'POST')) !== 'GET';
    const res = await call(h, path, { ...init, headers: { ...withCookie(cookie, unsafe), ...init.headers } });
    return { res, json: res.status === 204 ? null : ((await res.json()) as Json) };
  };
  return { cookie, send };
}

const role = { company: 'Acme', title: 'Engineer', startDate: '2020-01-01', endDate: '2021-12-31', current: false, skills: ['TypeScript', 'Postgres'] };

describe('completeness is derived from the data', () => {
  it('a new profile is 0 with every item listed, experience-related items first', async () => {
    const { send } = await signedIn();
    const { json } = await send('/profile');
    expect(json!.completeness).toBe(0);
    expect(json!.nextSteps.map((s) => s.id).slice(0, 3)).toEqual(['step_role_skills', 'step_experience', 'step_education']);
    expect(json!.stats).toEqual({});
  });

  it('a dated role with skill tags earns the experience weights (45%)', async () => {
    const { send } = await signedIn();
    const { res, json } = await send('/profile/experience', { body: role });
    expect(res.status).toBe(201);
    expect(json!.completeness).toBe(0.45);
    expect(json!.nextSteps.some((s) => s.id === 'step_experience')).toBe(false);
  });

  it('says what it read from a resume, and a confirmation or an edit makes it the person’s', async () => {
    const { send } = await signedIn();
    const draft = (await send('/profile/draft', { body: { skills: ['Go'], experiences: [{ ...role, id: 'x' }, { ...role, id: 'y', company: 'Second Co' }] } })).json!;
    const [first, second] = draft.experiences;
    expect(first!.provenance).toBe('parsed_confirmed');
    expect(draft.skillsToConfirm).toEqual(['Go']);

    const confirmed = (await send('/profile/confirm', { body: { kind: 'experience', id: first!.id } })).json!;
    expect(confirmed.experiences.map((e) => e.provenance)).toEqual(['user', 'parsed_confirmed']);

    const edited = (await send(`/profile/experience/${second!.id}`, { method: 'PUT', body: { ...role, company: 'Second Co', title: 'Renamed' } })).json!;
    expect(edited.experiences[1]!.provenance).toBe('user');

    const skills = (await send('/profile/confirm', { body: { kind: 'skills' } })).json!;
    expect(skills.skillsToConfirm).toBeUndefined();
  });

  it('won’t confirm a row that isn’t yours', async () => {
    const { send } = await signedIn();
    const { res } = await send('/profile/confirm', { body: { kind: 'experience', id: '00000000-0000-7000-8000-000000000000' } });
    expect(res.status).toBe(404);
  });

  it('no call moves completeness without a data change', async () => {
    const { send } = await signedIn();
    const added = (await send('/profile/experience', { body: { ...role, skills: [] } })).json!;
    const baseline = added.completeness;
    const etag = (await send('/profile')).res.headers.get('etag')!;
    const after = [
      (await send(`/profile/next-steps/${added.nextSteps[0]!.id}/complete`, { method: 'POST' })).json!,
      (await send('/profile/preferences', { method: 'PATCH', body: { remote: 'hybrid' }, headers: { 'if-match': etag } })).json!,
      (await send(`/profile/experience/${added.experiences[0]!.id}`, { method: 'PUT', body: { ...role, skills: [] } })).json!,
      (await send('/profile')).json!,
    ];
    for (const profile of after) expect(profile.completeness).toBe(baseline);
    // Tagging the role is a data change, and it moves.
    const tagged = (await send(`/profile/experience/${added.experiences[0]!.id}`, { method: 'PUT', body: role })).json!;
    expect(tagged.completeness).toBeGreaterThan(baseline);
  });

  it('the stored completeness matches the derived one after every write', async () => {
    const { send } = await signedIn();
    const { json } = await send('/profile/skills', { method: 'PUT', body: { skills: ['A', 'B', 'C'] } });
    const user = await h.db.withSystem('test: read stored completeness', (tx) =>
      tx.selectFrom('profiles').select('completeness_bps').where('user_id', '=', String(json!.userId)).executeTakeFirstOrThrow(),
    );
    expect(user.completeness_bps / 10_000).toBe(json!.completeness);
  });
});

describe('conditional writes', () => {
  it('identity changes need If-Match: missing is 428, stale is 412, current succeeds', async () => {
    const { send } = await signedIn();
    const etag = (await send('/profile')).res.headers.get('etag')!;
    expect((await send('/profile', { method: 'PATCH', body: { headline: 'A' } })).res.status).toBe(428);
    expect((await send('/profile', { method: 'PATCH', body: { headline: 'A' }, headers: { 'if-match': '"v9999"' } })).res.status).toBe(412);
    const ok = await send('/profile', { method: 'PATCH', body: { headline: 'A' }, headers: { 'if-match': etag } });
    expect(ok.res.status).toBe(200);
    expect(ok.res.headers.get('etag')).not.toBe(etag);
    // The ETag from that answer is good for the next write: no reload needed.
    const next = await send('/profile', { method: 'PATCH', body: { tagline: 'B' }, headers: { 'if-match': ok.res.headers.get('etag')! } });
    expect(next.res.status).toBe(200);
  });

  it('every write answers with the current ETag, including entry writes', async () => {
    const { send } = await signedIn();
    const { res } = await send('/profile/experience', { body: role });
    expect((await send('/profile')).res.headers.get('etag')).toBe(res.headers.get('etag'));
  });
});

describe('owner scoping', () => {
  it("another user's entry id is 404 for read-modify and delete, and stays untouched", async () => {
    const a = await signedIn();
    const b = await signedIn();
    const id = (await a.send('/profile/experience', { body: role })).json!.experiences[0]!.id;
    expect((await b.send(`/profile/experience/${id}`, { method: 'PUT', body: role })).res.status).toBe(404);
    expect((await b.send(`/profile/experience/${id}`, { method: 'DELETE' })).res.status).toBe(404);
    expect((await a.send('/profile')).json!.experiences.map((e) => e.id)).toEqual([id]);
  });
});

describe('data integrity', () => {
  it('dates round-trip exactly in a time zone east of UTC', async () => {
    const { send } = await signedIn();
    const { json } = await send('/profile/experience', { body: { ...role, startDate: '2019-01-01', endDate: '2019-12-31' } });
    expect(json!.experiences[0]).toMatchObject({ startDate: '2019-01-01', endDate: '2019-12-31' });
  });

  it('an end date before the start date is a 400 naming the constraint, not a 500', async () => {
    const { send } = await signedIn();
    const { res, json } = await send('/profile/experience', { body: { ...role, startDate: '2022-01-01', endDate: '2021-01-01' } });
    expect(res.status).toBe(400);
    expect(json).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('typed facts are `user`; facts from a confirmed upload are `parsed_confirmed`', async () => {
    const { send } = await signedIn();
    await send('/profile/experience', { body: role });
    const { json } = await send('/profile/draft', { body: { experiences: [{ ...role, id: 'x', title: 'Parsed Role' }], skills: ['Parsed Skill'] } });
    const userId = String(json!.userId);
    const rows = await h.db.withSystem('test: provenance', async (tx) => ({
      roles: await tx.selectFrom('experience').select(['title', 'provenance']).where('user_id', '=', userId).orderBy('sort_order').execute(),
      skills: await tx.selectFrom('profile_skills').select(['raw_name', 'provenance']).where('user_id', '=', userId).execute(),
    }));
    expect(rows.roles).toEqual([{ title: 'Engineer', provenance: 'user' }, { title: 'Parsed Role', provenance: 'parsed_confirmed' }]);
    expect(rows.skills).toEqual([{ raw_name: 'Parsed Skill', provenance: 'parsed_confirmed' }]);
  });

  it('a cross-site write with a cookie is refused before it reaches the profile', async () => {
    const { cookie } = await signedIn();
    const res = await call(h, '/profile/skills', { method: 'PUT', body: { skills: ['x'] }, headers: { cookie, origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
    expect(ORIGIN).toBeTruthy();
  });
});
