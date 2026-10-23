import { canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { LatexCompileError, type LatexCompiler } from '../../src/export/latex/compile';
import { createPdfRenderer, type PdfRenderer } from '../../src/export/renderPdf';
import { exportStatus, requestExport, runExport } from '../../src/services/exports';
import { resumePreview } from '../../src/services/renderPreview';
import { runRender } from '../../src/services/renders';
import * as library from '../../src/services/resumes';
import { writeResumeVersion } from '../../src/services/versions';
import { buildStorage } from '../../src/storage/build';
import { backendUser, readyJd, runToEnd } from './fixtures/documents';
import { deleteUsers, log } from './fixtures/pipeline';

/**
 * LaTeX renders (toreview §111): every resume version is queued for typesetting as it is written;
 * the worker stores its PDF and page images; the preview hands them out with no export gate and
 * keeps the earlier pages up while a new version is typeset; a PDF export is the render's own
 * file, named for the person the resume names; deleting the resume deletes every render file.
 * The compiler here is a stand-in that returns fixed bytes; the sealed service is tested on its own.
 */
const config = loadConfig();
let db: Database;
let pdf: PdfRenderer;
const storage = buildStorage(config);
const bucket = config.S3_BUCKET_EXPORTS;
const users: string[] = [];
const as = (userId: string) => ({ userId, role: 'user' as const });
const deps = () => ({ db, storage, bucket });

/** A PNG's signature and IHDR: enough for the page size. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function compiler(pages: number | ((tex: string) => number) = 1, fail?: LatexCompileError): LatexCompiler & { sources: string[] } {
  const sources: string[] = [];
  return {
    sources,
    async compile(tex) {
      sources.push(tex);
      if (fail) throw fail;
      const count = typeof pages === 'number' ? pages : pages(tex);
      return { pdf: new TextEncoder().encode(`%PDF-1.7 stand-in ${sources.length}`), pages: count, pngs: Array.from({ length: count }, () => png(1275, 1650)), ms: 5 };
    },
  };
}

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 6 });
  pdf = createPdfRenderer(config.CHROMIUM_PATH ? { executablePath: config.CHROMIUM_PATH } : {});
});
afterAll(async () => {
  await pdf.close();
  await deleteUsers(db, users);
  await db.destroy();
});

async function generated() {
  const userId = await backendUser(db, users);
  await db.withSystem('test: account state', (tx) => tx.updateTable('users').set({ email_verified: true, first_name: 'Jane', last_name: 'Müller' }).where('id', '=', userId).execute());
  const jd = await readyJd(db, userId, groundedModel);
  const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);
  return { userId, resumeId: run.resumeId!, jdId: jd.id };
}

const pendingRenders = (userId: string, resumeId: string) =>
  db.withUser(as(userId), (tx) => tx.selectFrom('resume_renders').select(['id', 'resume_version_id']).where('resume_id', '=', resumeId).where('status', '=', 'pending').orderBy('created_at').execute());

async function renderAll(userId: string, resumeId: string, latex: LatexCompiler, lastAttempt = false) {
  const outcomes = [];
  for (const r of await pendingRenders(userId, resumeId)) outcomes.push(await runRender({ ...deps(), latex, log }, { renderId: r.id, userId }, lastAttempt));
  return outcomes;
}

async function newVersion(userId: string, resumeId: string, jdId: string, change: (doc: ReturnType<typeof canonicalResumeSchema.parse>) => void) {
  return db.withUser(as(userId), async (tx) => {
    const row = await tx.selectFrom('resumes as r').innerJoin('resume_versions as v', 'v.id', 'r.current_version_id').select('v.content').where('r.id', '=', resumeId).executeTakeFirstOrThrow();
    const doc = canonicalResumeSchema.parse(row.content);
    change(doc);
    return writeResumeVersion(tx, { userId, resumeId, jdId, doc, note: 'test edit', createdBy: 'user' });
  });
}

describe('renders (toreview §111)', () => {
  it('a written version is queued, typeset and previewed without any export gate', async () => {
    const { userId, resumeId } = await generated();
    expect(await pendingRenders(userId, resumeId)).toHaveLength(1);
    expect((await resumePreview(deps(), as(userId), resumeId)).status).toBe('pending');

    const latex = compiler(2);
    expect(await renderAll(userId, resumeId, latex)).toEqual(['rendered']);
    expect(latex.sources[0]).toContain('\\begin{document}');
    expect(latex.sources[0]).toContain('Jane Müller'); // no header in a generated resume: the account's name

    const preview = await resumePreview(deps(), as(userId), resumeId);
    expect(preview).toMatchObject({ status: 'ready', pageCount: 2, paper: 'letter' });
    expect(preview.pages).toHaveLength(2);
    expect(preview.pages[0]).toMatchObject({ width: 1275, height: 1650 });
    expect(preview.pdfUrl).toContain('Jane_M');

    // Not the accuracy prompt, not the export: another user cannot see it.
    const other = await backendUser(db, users);
    await expect(resumePreview(deps(), as(other), resumeId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps the earlier pages up, flagged stale, while a new version is typeset', async () => {
    const { userId, resumeId, jdId } = await generated();
    await renderAll(userId, resumeId, compiler());
    await newVersion(userId, resumeId, jdId, (doc) => void (doc.headline = 'Platform engineer'));
    const preview = await resumePreview(deps(), as(userId), resumeId);
    expect(preview).toMatchObject({ status: 'pending', stale: true });
    expect(preview.pages).toHaveLength(1);
    expect(preview.pdfUrl).toBeUndefined();
    await renderAll(userId, resumeId, compiler());
    expect((await resumePreview(deps(), as(userId), resumeId)).status).toBe('ready');
  });

  it('a source Tectonic refuses fails at once; a service outage is retried, then queued again by the preview', async () => {
    const { userId, resumeId, jdId } = await generated();
    expect(await renderAll(userId, resumeId, compiler(1, new LatexCompileError('compile', 'Undefined control sequence', ['! Undefined control sequence.'])))).toEqual(['failed']);
    expect((await resumePreview(deps(), as(userId), resumeId)).status).toBe('failed');

    await newVersion(userId, resumeId, jdId, (doc) => void (doc.headline = 'Data engineer'));
    const down = compiler(1, new LatexCompileError('unavailable', 'connection refused'));
    await expect(renderAll(userId, resumeId, down)).rejects.toThrow('connection refused'); // redelivered
    expect(await renderAll(userId, resumeId, down, true)).toEqual(['failed']);
    expect((await resumePreview(deps(), as(userId), resumeId)).status).toBe('failed');
    await db.withSystem('test: the outage was a while ago', (tx) => tx.updateTable('resume_renders').set({ completed_at: new Date(Date.now() - 10 * 60_000) }).where('resume_id', '=', resumeId).where('error_code', '=', 'unavailable').execute());
    expect((await resumePreview(deps(), as(userId), resumeId)).status).toBe('pending');
    expect(await renderAll(userId, resumeId, compiler())).toEqual(['rendered']);
  });

  it('a PDF export is the render’s own file, named for the resume’s header', async () => {
    const { userId, resumeId, jdId } = await generated();
    await newVersion(userId, resumeId, jdId, (doc) => void (doc.header = { name: 'Alex Rivera', items: [{ text: 'alex.rivera@example.com', url: 'mailto:alex.rivera@example.com' }] }));
    const latex = compiler();
    await renderAll(userId, resumeId, latex);
    expect(latex.sources.at(-1)).toContain('Alex Rivera');
    await library.confirmAccuracy(db, as(userId), resumeId);
    const compiled = latex.sources.length;

    const first = await requestExport(deps(), as(userId), resumeId, 'pdf', undefined, null);
    expect(first.fileName).toMatch(/^Alex_Rivera/);
    expect(await runExport({ ...deps(), pdf, latex, log }, { exportId: first.id, userId }, false)).toBe('rendered');
    const ready = await exportStatus(deps(), as(userId), first.id);
    expect(ready.status).toBe('ready');
    expect(ready.atsSafe).toBeUndefined(); // a LaTeX PDF makes no ATS-safe claim until it is read back
    const key = await db.withUser(as(userId), (tx) => tx.selectFrom('export_events').select('object_key').where('id', '=', first.id).executeTakeFirstOrThrow());
    const bytes = await storage.read(bucket, key.object_key!, 1_000_000);
    expect(new TextDecoder().decode(bytes)).toBe(`%PDF-1.7 stand-in ${latex.sources.length}`);
    expect(latex.sources).toHaveLength(compiled); // copied from the render, not compiled again
  });

  it('tightens the spacing until a fresher’s resume fits one page; an experienced one may take two', async () => {
    // The stand-in sets two pages at the template’s own margins and one at any tighter rung.
    const byDensity = () => compiler((tex) => (tex.includes('left=0.55in') ? 2 : 1));
    const { userId, resumeId, jdId } = await generated();
    const experienced = byDensity();
    await renderAll(userId, resumeId, experienced);
    expect(experienced.sources).toHaveLength(1); // 2009 to now: two pages are within budget

    await newVersion(userId, resumeId, jdId, (doc) => void (doc.roles = doc.roles.slice(0, 1).map((r) => ({ ...r, start: '2024-01', end: null }))));
    const fresher = byDensity();
    await renderAll(userId, resumeId, fresher);
    expect(fresher.sources).toHaveLength(2);
    const rows = await db.withUser(as(userId), (tx) => tx.selectFrom('resume_renders').select(['density', 'page_count']).where('resume_id', '=', resumeId).orderBy('created_at').execute());
    expect(rows).toEqual([{ density: 0, page_count: 2 }, { density: 1, page_count: 1 }]);
  });

  it('deleting the resume deletes every render file', async () => {
    const { userId, resumeId } = await generated();
    await renderAll(userId, resumeId, compiler(2));
    const row = await db.withUser(as(userId), (tx) => tx.selectFrom('resume_renders').select(['pdf_key', 'page_keys']).where('resume_id', '=', resumeId).executeTakeFirstOrThrow());
    const keys = [row.pdf_key!, ...(row.page_keys as { key: string }[]).map((p) => p.key)];
    expect(keys).toHaveLength(3);
    for (const key of keys) expect(await storage.head(bucket, key)).not.toBeNull();
    await library.removeDocument({ db, storage, exportsBucket: bucket }, as(userId), resumeId);
    for (const key of keys) expect(await storage.head(bucket, key)).toBeNull();
  });
});
