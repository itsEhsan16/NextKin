import { asOfDate, documentFromContent, PARSE_SAFE_TEMPLATE } from '@nextkin/shared/scoring/adapters';
import { scoreDocument } from '@nextkin/shared/scoring/report';
import { scoringJdOf } from '@nextkin/shared/scoring/tailorComparison';
import { randomUUID } from 'node:crypto';

import { CANONICAL_SCHEMA_VERSION } from '@nextkin/shared/schemas/resumeContent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createJd } from '../../src/services/jd';
import { readContent } from '../../src/services/resumeRead';
import { compareResumeToJd } from '../../src/services/tailorCompare';
import { insertVersion } from '../../src/services/versions';
import { backendUser, readyJd, runToEnd } from './fixtures/documents';
import { createUser, deleteUsers } from './fixtures/pipeline';

/**
 * W-TAILOR 01 on the server (toreview §110): a resume measured against a JD by the engines, the
 * resume as its own yardstick, with no model call; only the owner's resume, only a ready JD.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 4 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

describe('the tailor comparison (P14)', () => {
  it("is the engine's own score of the resume against the JD", async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const built = await runToEnd(db, userId, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);

    const comparison = await compareResumeToJd(db, identity, jd.id, built.resumeId!);
    expect(comparison).toMatchObject({ resumeId: built.resumeId, jdId: jd.id, scored: true, pagesEstimated: true });
    expect(comparison.pageCount).toBeGreaterThanOrEqual(1);
    expect(comparison.improvements.map((r) => r.key)).toEqual(['headline', 'summary', 'length', 'layout']);

    // The same engine run, done here by hand, gives the same number and keywords.
    const content = await db.withUser(identity, (tx) => readContent(tx, userId, built.resumeId!));
    if (content.kind !== 'resume') throw new Error('not a resume');
    const contact = { email: Boolean(content.contact?.email), phone: Boolean(content.contact?.phone), location: Boolean(content.contact?.location) };
    const direct = scoreDocument({ document: documentFromContent(content, contact), format: PARSE_SAFE_TEMPLATE, asOf: asOfDate(new Date()), jd: scoringJdOf(jd) });
    expect(comparison.score).toBe(direct.score?.total);
    expect(comparison.keywords.filter((k) => k.onResume).length).toBe(direct.report.requirements.filter((r) => r.status === 'met' || r.status === 'partial').length);
    expect(comparison.keywords.some((k) => k.onResume)).toBe(true);
  }, 60_000);

  it('an upload, still as uploaded, brings its own page count and measured layout; once edited it is NextKin’s (toreview §110.6)', async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const line = (id: string, text: string) => ({ id, text, evidence: [], origin: 'user' as const });
    const doc = {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      headline: 'Backend engineer',
      summary: line('s', 'Backend engineer working on payment systems.'),
      skills: [{ id: 'k0', name: 'Go', evidence: [], origin: 'user' as const }],
      roles: [{ roleId: 'r0', company: 'Lumen Pay', title: 'Senior Backend Engineer', start: '2020-03', end: null, skills: ['Go'], bullets: [line('b0', 'Built the settlement service in Go')] }],
      education: [],
      certifications: [],
      projects: [],
    };
    const resumeId = await db.withUser(identity, async (tx) => {
      const upload = await tx.insertInto('uploads').values({ user_id: userId, purpose: 'resume', bucket: 'test', object_key: `test/${randomUUID()}`, file_name: 'cv.pdf', declared_type: 'application/pdf', status: 'clean' }).returning('id').executeTakeFirstOrThrow();
      const resume = await tx.insertInto('resumes').values({ user_id: userId, title: 'cv', doc_type: 'resume', source: 'uploaded' }).returning('id').executeTakeFirstOrThrow();
      await insertVersion(tx, { userId, resumeId: resume.id, content: doc, note: 'Uploaded cv.pdf', createdBy: 'upload' });
      const layout = { singleColumn: true, noTablesOrImages: false, standardHeadings: true, standardFonts: true, contactInBody: true, found: ['a picture (a photo or a logo)'] };
      await tx.insertInto('resume_parses').values({ user_id: userId, upload_id: upload.id, status: 'ready', finished_at: new Date(), resume_id: resume.id, findings: JSON.stringify({ kind: 'pdf', pages: 1, layout }) }).execute();
      return resume.id;
    });
    const layoutRow = (c: { improvements: { key: string }[] }) => c.improvements.find((r) => r.key === 'layout');

    const uploaded = await compareResumeToJd(db, identity, jd.id, resumeId);
    expect(uploaded.pageCount).toBe(1);
    expect(uploaded.pagesEstimated).toBeFalsy();
    expect(layoutRow(uploaded)).toMatchObject({ ok: false, detail: 'Your file has a picture (a photo or a logo). The tailored resume downloads in a one-column ATS layout.' });

    // Edited here, it downloads in NextKin's template: the template's layout, an estimated length,
    // and the layout points the picture cost come back.
    await db.withUser(identity, (tx) => insertVersion(tx, { userId, resumeId, content: doc, note: 'Edited', createdBy: 'user' }));
    const edited = await compareResumeToJd(db, identity, jd.id, resumeId);
    expect(edited).toMatchObject({ pagesEstimated: true });
    expect(layoutRow(edited)).toMatchObject({ ok: true, detail: expect.stringContaining('NextKin’s one-column template') });
    expect(edited.score).toBeGreaterThan(uploaded.score);
  }, 60_000);

  it("never measures another user's resume", async () => {
    const owner = await backendUser(db, users);
    const jd = await readyJd(db, owner, groundedModel);
    const built = await runToEnd(db, owner, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);
    const stranger = await createUser(db, users);
    const strangersJd = await readyJd(db, stranger, groundedModel);
    await expect(compareResumeToJd(db, { userId: stranger, role: 'user' }, strangersJd.id, built.resumeId!)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  }, 60_000);

  it('waits for the JD to be read', async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const built = await runToEnd(db, userId, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);
    const reading = await createJd(db, identity, { source: 'paste', text: 'Platform engineer. Requirements: Go and Kubernetes are required for this role, with PostgreSQL.' }, null);
    await expect(compareResumeToJd(db, identity, reading.id, built.resumeId!)).rejects.toMatchObject({ code: 'CONFLICT' });
  }, 60_000);
});
