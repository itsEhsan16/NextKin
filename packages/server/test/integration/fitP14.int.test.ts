import { CANONICAL_SCHEMA_VERSION, canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMemoryKv } from '../../src/cache/kv';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import type { LatexCompiler } from '../../src/export/latex/compile';
import { fitStatus, requestFit, runFit } from '../../src/services/resumeFit';
import * as library from '../../src/services/resumes';
import { insertVersion } from '../../src/services/versions';
import { createUser, deleteUsers, log } from './fixtures/pipeline';

/**
 * "Fit to one page" (toreview §113) against Postgres, with a stand-in compiler: two pages while
 * more than three of the lines print. Synthetic (L4).
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];
const kv = createMemoryKv();
const as = (userId: string) => ({ userId, role: 'user' as const });

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 4 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

const TEXTS = ['Built the booking flow in React', 'Ordered supplies', 'Tuned SQL queries', 'Ran the weekly demo', 'Answered tickets', 'Kept the wiki tidy'];
const line = (id: string, text: string) => ({ id, text, evidence: [] as string[], origin: 'user' as const });
const DOC: CanonicalResumeJson = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  skills: [],
  roles: [{ roleId: 'now', company: 'Webcros', title: 'Developer', start: '2024-02', end: null, skills: [], bullets: TEXTS.map((t, i) => line(`b${i}`, t)) }],
  education: [],
  certifications: [],
  projects: [],
};
const compiler = (pages?: number): LatexCompiler => ({
  async compile(tex) {
    return { pdf: new Uint8Array([37]), pages: pages ?? (TEXTS.filter((t) => tex.includes(t)).length > 3 ? 2 : 1), pngs: [], ms: 1 };
  },
});

async function resume(userId: string) {
  return db.withUser(as(userId), async (tx) => {
    const r = await tx.insertInto('resumes').values({ user_id: userId, title: 'Mine', doc_type: 'resume', source: 'uploaded' }).returning('id').executeTakeFirstOrThrow();
    const versionId = await insertVersion(tx, { userId, resumeId: r.id, content: DOC, note: 'Uploaded', createdBy: 'user' });
    return { resumeId: r.id, versionId };
  });
}

describe('fit to one page (toreview §113)', () => {
  it('drops the fewest bullets to fit, as a new version, and says so', async () => {
    const userId = await createUser(db, users);
    const { resumeId, versionId } = await resume(userId);
    // Confirmed accurate before the fit: the fitted version keeps it (toreview §114).
    await library.confirmAccuracy(db, as(userId), resumeId);
    const fit = await requestFit(db, kv, as(userId), resumeId, null);
    expect(await fitStatus(kv, as(userId), resumeId, fit.id)).toEqual({ status: 'running' });
    expect(await runFit({ db, kv, latex: compiler(), log }, { fitId: fit.id, userId, resumeId, versionId })).toBe('done');
    expect(await fitStatus(kv, as(userId), resumeId, fit.id)).toEqual({ status: 'done', changed: true, pages: 1, dropped: 3 });
    const latest = await db.withUser(as(userId), (tx) => tx.selectFrom('resumes as r').innerJoin('resume_versions as v', 'v.id', 'r.current_version_id').select(['v.content', 'v.change_note', 'v.accuracy_confirmed_at']).where('r.id', '=', resumeId).executeTakeFirstOrThrow());
    expect(latest.change_note).toBe('Fitted to one page: 3 bullets left out');
    expect(latest.accuracy_confirmed_at).not.toBeNull();
    expect(canonicalResumeSchema.parse(latest.content).roles[0]!.bullets.map((b) => b.text)).toEqual(TEXTS.slice(0, 3));
    // Another user cannot read it.
    const other = await createUser(db, users);
    await expect(fitStatus(kv, as(other), resumeId, fit.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('says when it cannot fit, or when the resume changed meanwhile, and writes nothing', async () => {
    const userId = await createUser(db, users);
    const { resumeId, versionId } = await resume(userId);
    const fit = await requestFit(db, kv, as(userId), resumeId, null);
    expect(await runFit({ db, kv, latex: compiler(2), log }, { fitId: fit.id, userId, resumeId, versionId })).toBe('failed');
    expect(await fitStatus(kv, as(userId), resumeId, fit.id)).toEqual({ status: 'failed', reason: 'cannot_fit' });
    expect(await runFit({ db, kv, latex: compiler(), log }, { fitId: fit.id, userId, resumeId, versionId: '00000000-0000-4000-8000-000000000000' })).toBe('failed');
    expect(await fitStatus(kv, as(userId), resumeId, fit.id)).toEqual({ status: 'failed', reason: 'changed_meanwhile' });
    const versions = await db.withUser(as(userId), (tx) => tx.selectFrom('resume_versions').select('id').where('resume_id', '=', resumeId).execute());
    expect(versions).toHaveLength(1);
  });
});
