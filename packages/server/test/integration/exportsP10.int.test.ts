import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { certifyTemplate, CERTIFICATION_RESUME } from '../../src/export/certify';
import { expectedLines, resumeModel } from '../../src/export/model';
import { parseBack, pdfReadingText } from '../../src/export/parseBack';
import { createPdfRenderer, type PdfRenderer } from '../../src/export/renderPdf';
import { CLASSIC, TWO_COLUMN_TEST } from '../../src/export/templates';
import { nullPublisher } from '../../src/pipeline/events';
import { runMaintenanceJob } from '../../src/scheduler/jobs';
import { exportStatus, requestExport, runExport } from '../../src/services/exports';
import * as content from '../../src/services/resumeContent';
import * as library from '../../src/services/resumes';
import { buildStorage } from '../../src/storage/build';
import { backendUser, readyJd, runToEnd } from './fixtures/documents';
import { deleteUsers, log } from './fixtures/pipeline';

/**
 * Rendering and delivery (ImBackendImplementationPlan P10-04…P10-08, P10-03): template
 * certification by parse-back, byte-identical PDFs, the export gates in order, presigned links of
 * at most 15 minutes, a rendered file reused per version, permanent delete and the 30-day purge
 * removing files by reference. Chromium is the worker's (CHROMIUM_PATH locally).
 */
const config = loadConfig();
let db: Database;
let pdf: PdfRenderer;
const storage = buildStorage(config);
const bucket = config.S3_BUCKET_EXPORTS;
const users: string[] = [];
const as = (userId: string) => ({ userId, role: 'user' as const });
const deps = () => ({ db, storage, bucket });

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 6 });
  pdf = createPdfRenderer(config.CHROMIUM_PATH ? { executablePath: config.CHROMIUM_PATH } : {});
});
afterAll(async () => {
  await pdf.close();
  await deleteUsers(db, users);
  await db.destroy();
});

async function generated(options: { verified?: boolean; pro?: boolean } = {}) {
  const userId = await backendUser(db, users);
  await db.withSystem('test: account state', async (tx) => {
    await tx.updateTable('users').set({ email_verified: options.verified ?? true, first_name: 'Jane', last_name: 'Müller' }).where('id', '=', userId).execute();
  });
  if (options.pro) {
    await db.withUser(as(userId), async (tx) => {
      const account = await tx.insertInto('billing_accounts').values({ owner_user_id: userId }).returning('id').executeTakeFirstOrThrow();
      await tx.insertInto('subscriptions').values({ billing_account_id: account.id, user_id: userId, plan_id: 'pro_monthly', status: 'active' }).execute();
    });
  }
  const jd = await readyJd(db, userId, groundedModel);
  const run = await runToEnd(db, userId, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);
  return { userId, resumeId: run.resumeId! };
}

/** Requests an export, renders it as the worker would, and returns the ready status. */
async function exported(userId: string, resumeId: string, format: 'pdf' | 'docx' | 'txt') {
  const first = await requestExport(deps(), as(userId), resumeId, format, undefined, null);
  if (first.status === 'pending') expect(await runExport({ ...deps(), pdf, log }, { exportId: first.id, userId }, false)).toBe('rendered');
  return exportStatus(deps(), as(userId), first.id);
}

describe('rendering and certification (P10-04…P10-06)', () => {
  it('NextKin Classic certifies in all three formats; a two-column layout fails parse-back', async () => {
    const classic = await certifyTemplate(CLASSIC, pdf);
    expect(classic.certified).toBe(true);
    expect(classic.results.pdf).toMatchObject({ ok: true, missing: [], outOfOrder: [], sectionsLost: [] });
    const twoColumn = await certifyTemplate(TWO_COLUMN_TEST, pdf);
    expect(twoColumn.certified).toBe(false);
    expect(twoColumn.results.pdf.ok).toBe(false);
    expect(twoColumn.results.pdf.sectionsLost.length).toBeGreaterThan(0);
  });

  it('a PDF is byte-identical across runs, renders in under 10 s, and its text is real and in order', async () => {
    const model = resumeModel(CERTIFICATION_RESUME, { name: 'Alex Example', email: 'alex@example.com' });
    const html = CLASSIC.html(model);
    const stamp = new Date('2026-03-01T09:30:00Z');
    const started = Date.now();
    const a = await pdf.render(html, stamp);
    expect(Date.now() - started).toBeLessThan(10_000);
    const b = await pdf.render(html, stamp);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    const text = await pdfReadingText(a);
    expect(text).toContain('Alex Example');
    expect((await parseBack(model, 'pdf', a)).ok).toBe(true);
    expect(expectedLines(model).length).toBeGreaterThan(20);
  });
});

describe('export delivery (P10-07, P10-08)', () => {
  it('holds the gates in order, then delivers a presigned PDF that lasts at most 15 minutes', async () => {
    const { userId, resumeId } = await generated({ verified: false });
    await expect(requestExport(deps(), as(userId), resumeId, 'docx', undefined, null)).rejects.toMatchObject({ code: 'PLAN_LOCKED' });
    await expect(requestExport(deps(), as(userId), resumeId, 'pdf', undefined, null)).rejects.toMatchObject({ code: 'EXPORT_BLOCKED', details: { reason: 'email' } });
    await db.withSystem('test: verify the email', (tx) => tx.updateTable('users').set({ email_verified: true }).where('id', '=', userId).execute());
    await expect(requestExport(deps(), as(userId), resumeId, 'pdf', undefined, null)).rejects.toMatchObject({ code: 'EXPORT_BLOCKED', details: { reason: 'accuracy' } });
    expect((await library.confirmAccuracy(db, as(userId), resumeId)).accuracyConfirmed).toBe(true);

    const ready = await exported(userId, resumeId, 'pdf');
    expect(ready).toMatchObject({ status: 'ready', format: 'pdf', mimeType: 'application/pdf', fileName: expect.stringMatching(/^Jane_Muller_.+\.pdf$/), atsSafe: true });
    const url = new URL(ready.url!);
    expect(Number(url.searchParams.get('X-Amz-Expires'))).toBeLessThanOrEqual(900);
    const response = await fetch(ready.url!);
    expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
    expect(response.headers.get('content-disposition')).toContain('attachment');

    // The same version, format and template reuse the rendered file.
    expect((await requestExport(deps(), as(userId), resumeId, 'pdf', undefined, null)).id).toBe(ready.id);
    // A new version asks for confirmation again.
    await content.updateSection(db, as(userId), resumeId, 'summary', 'An edited summary the user wrote themselves.');
    await expect(requestExport(deps(), as(userId), resumeId, 'pdf', undefined, null)).rejects.toMatchObject({ code: 'EXPORT_BLOCKED', details: { reason: 'accuracy' } });
  });

  it('DOCX (Pro) and TXT read back with every line of the model', async () => {
    const { userId, resumeId } = await generated({ pro: true });
    await library.confirmAccuracy(db, as(userId), resumeId);
    for (const format of ['docx', 'txt'] as const) {
      const ready = await exported(userId, resumeId, format);
      expect(ready).toMatchObject({ status: 'ready', atsSafe: true });
      const row = await db.withUser(as(userId), (tx) => tx.selectFrom('export_events').select(['parse_back']).where('id', '=', ready.id).executeTakeFirstOrThrow());
      expect(row.parse_back).toMatchObject({ ok: true, missing: [] });
      expect(ready.receipt?.bullets.found).toBe(ready.receipt?.bullets.total);
      expect(ready.receipt?.sections.found).toBe(ready.receipt?.sections.total);
    }
  });

  it('delete is permanent and takes the exported files with it', async () => {
    const { userId, resumeId } = await generated();
    await library.confirmAccuracy(db, as(userId), resumeId);
    const ready = await exported(userId, resumeId, 'txt');
    const key = (await db.withUser(as(userId), (tx) => tx.selectFrom('export_events').select('object_key').where('id', '=', ready.id).executeTakeFirstOrThrow())).object_key!;
    expect(await storage.head(bucket, key)).not.toBeNull();
    await library.removeDocument({ db, storage, exportsBucket: bucket }, as(userId), resumeId);
    expect(await storage.head(bucket, key)).toBeNull();
    await expect(library.restoreFromTrash(db, as(userId), resumeId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('trash and purge (P10-03)', () => {
  it('a trashed resume is recoverable on day 29 and gone, files included, on day 31', async () => {
    const { userId, resumeId } = await generated();
    await library.confirmAccuracy(db, as(userId), resumeId);
    const ready = await exported(userId, resumeId, 'txt');
    const key = (await db.withUser(as(userId), (tx) => tx.selectFrom('export_events').select('object_key').where('id', '=', ready.id).executeTakeFirstOrThrow())).object_key!;
    await library.trashDocument(db, as(userId), resumeId);
    expect((await library.listTrash(db, as(userId))).map((t) => t.id)).toContain(resumeId);
    const day = (n: number) => () => new Date(Date.now() + n * 24 * 3600 * 1000);
    const job = (n: number) => runMaintenanceJob('trash_purge', { db, log, publisher: nullPublisher, generationTimeoutSeconds: 180, documents: { storage, exportsBucket: bucket }, now: day(n) });

    await job(29);
    expect((await library.listTrash(db, as(userId))).map((t) => t.id)).toContain(resumeId);
    expect(await storage.head(bucket, key)).not.toBeNull();
    await job(31);
    expect((await library.listTrash(db, as(userId))).map((t) => t.id)).not.toContain(resumeId);
    expect(await storage.head(bucket, key)).toBeNull();
  });

  it('restoring from the trash brings the resume back to the library', async () => {
    const { userId, resumeId } = await generated();
    await library.trashDocument(db, as(userId), resumeId);
    expect((await library.restoreFromTrash(db, as(userId), resumeId)).id).toBe(resumeId);
  });
});
