import { MARKETS, marketForLocation, paperForLocation } from '@nextkin/engines/markets';
import { EXPORT_BLOCK_MESSAGE, type ExportBlock } from '@nextkin/shared/models/exportBlock';
import type { ExportReceipt } from '@nextkin/shared/models/resume';
import { exportProblem } from '@nextkin/shared/scoring/resumeDocumentCheck';
import { contentNeedsReview } from '@nextkin/shared/models/resumeContent';
import { canonicalLetterSchema, canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';

import type { Database, Identity } from '../db/database';
import { letterModel, resumeModel, exportFileName, type RenderModel } from '../export/model';
import { parseBack, readingText, receiptOf } from '../export/parseBack';
import { renderDocx } from '../export/renderDocx';
import type { LatexCompiler } from '../export/latex/compile';
import type { PdfRenderer } from '../export/renderPdf';
import { renderTxt } from '../export/renderTxt';
import { DEFAULT_TEMPLATE, TEMPLATES } from '../export/templates';
import { AppError, errors } from '../http/errors';
import type { Logger } from '../observability/logger';
import { enqueue } from '../outbox/outbox';
import { MAX_PRESIGN_GET_SECONDS, type StoragePort } from '../storage/storage';
import { planOf } from './plan';
import { readBackTypeset, typesetPdf } from './renderExport';
import { ownerOf } from './resumeDocument';
import { contentOf } from './resumeRead';

/**
 * Export delivery (ImBackendImplementationPlan P10-04…P10-08; V2 §7.12). A request is checked
 * against the gates, in this order: an open Zero Resume review (§7.9), DOCX on the free plan
 * (§13.3: PDF is never paywalled), an unverified email (§7.1), and the once-per-version accuracy
 * confirmation (§15 risk 2). It then renders on the worker into the exports bucket, is read back
 * (Q-06), and is handed out as a presigned GET that lasts at most 15 minutes. A version's file is
 * rendered once per format and template and reused; no document body passes through the web tier.
 */

export type ExportFormat = 'pdf' | 'docx' | 'txt';

export const MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain; charset=utf-8',
};

export interface ExportDeps {
  db: Database;
  storage: StoragePort;
  bucket: string;
}

export interface ExportStatus {
  id: string;
  status: 'pending' | 'ready' | 'failed';
  format: ExportFormat;
  fileName: string;
  mimeType: string;
  url?: string;
  expiresAt?: string;
  atsSafe?: boolean;
  receipt?: ExportReceipt;
  message?: string;
}

const blocked = (reason: ExportBlock) => new AppError('EXPORT_BLOCKED', EXPORT_BLOCK_MESSAGE[reason], { reason });

export async function requestExport(deps: ExportDeps, identity: Identity, resumeId: string, format: ExportFormat, templateSlug: string | undefined, correlationId: string | null): Promise<ExportStatus> {
  const template = TEMPLATES[templateSlug ?? DEFAULT_TEMPLATE];
  if (!template || !template.offered) throw errors.validation({ template: templateSlug }, 'That template is not available.');
  const created = await deps.db.withUser(identity, async (tx) => {
    const row = await tx
      .selectFrom('resumes as r')
      .innerJoin('resume_versions as v', 'v.id', 'r.current_version_id')
      .select(['r.id', 'r.title', 'r.doc_type', 'r.target_role', 'v.id as version_id', 'v.content', 'v.accuracy_confirmed_at'])
      .where('r.id', '=', resumeId)
      .where('r.trashed_at', 'is', null)
      .executeTakeFirst();
    if (!row) throw errors.notFound('resume');
    const content = contentOf(row.doc_type, row.content, { resumeId: row.id, versionId: row.version_id });
    if (!content) throw errors.notFound('content');
    if (contentNeedsReview(content)) throw blocked('review');
    if (row.doc_type === 'resume') {
      // An empty or half-filled page never goes out (toreview §124); the sentence names what is missing.
      const parsed = canonicalResumeSchema.safeParse(row.content);
      const problem = parsed.success ? exportProblem(parsed.data, await ownerOf(tx, identity.userId)) : null;
      if (problem) throw new AppError('EXPORT_BLOCKED', problem, { reason: 'incomplete' });
    }
    if (format === 'docx' && !(await planOf(tx, identity.userId)).docx) throw new AppError('PLAN_LOCKED', 'DOCX export needs NextKin Pro.');
    const user = await tx.selectFrom('users').select(['email_verified', 'first_name', 'last_name']).where('id', '=', identity.userId).executeTakeFirstOrThrow();
    if (!user.email_verified) throw blocked('email');
    if (!row.accuracy_confirmed_at) throw blocked('accuracy');

    const reusable = await tx
      .selectFrom('export_events')
      .selectAll()
      .where('resume_version_id', '=', row.version_id)
      .where('format', '=', format)
      .where('template_slug', '=', template.slug)
      .where('status', 'in', ['pending', 'ready'])
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    if (reusable) return { row: reusable, fresh: false };

    // The file is named for the person the resume names: its own header, else the account (toreview §111).
    const header = (row.content as { header?: { name?: string } } | null)?.header?.name;
    const name = header ?? `${user.first_name} ${user.last_name}`.trim();
    const inserted = await tx
      .insertInto('export_events')
      .values({ user_id: identity.userId, resume_id: row.id, resume_version_id: row.version_id, format, template_slug: template.slug, file_name: exportFileName(name, row.target_role ?? row.title, format) })
      .returningAll()
      .executeTakeFirstOrThrow();
    await enqueue(tx, { queue: 'generation-priority', groupId: `${identity.userId}#export`, type: 'export.render', payload: { exportId: inserted.id, userId: identity.userId }, correlationId });
    return { row: inserted, fresh: true };
  });
  return statusOf(deps, created.row);
}

type EventRow = { parse_back: unknown; id: string; status: string; format: string; file_name: string; object_key: string | null; ats_safe: boolean | null; error_message: string | null };

async function statusOf(deps: ExportDeps, row: EventRow): Promise<ExportStatus> {
  const format = row.format as ExportFormat;
  const base = { id: row.id, format, fileName: row.file_name, mimeType: MIME[format] };
  if (row.status === 'failed') return { ...base, status: 'failed', message: row.error_message ?? 'We could not make that file. Try again.' };
  if (row.status !== 'ready' || !row.object_key) return { ...base, status: 'pending' };
  const url = await deps.storage.presignGet(deps.bucket, row.object_key, { seconds: MAX_PRESIGN_GET_SECONDS, downloadName: row.file_name });
  const receipt = (row.parse_back as { receipt?: ExportReceipt } | null)?.receipt;
  return { ...base, status: 'ready', url, ...(receipt ? { receipt } : {}), expiresAt: new Date(Date.now() + MAX_PRESIGN_GET_SECONDS * 1000).toISOString(), ...(row.ats_safe !== null ? { atsSafe: row.ats_safe } : {}) };
}

export async function exportStatus(deps: ExportDeps, identity: Identity, exportId: string): Promise<ExportStatus> {
  const row = await deps.db.withUser(identity, (tx) => tx.selectFrom('export_events').selectAll().where('id', '=', exportId).executeTakeFirst());
  if (!row) throw errors.notFound('export');
  return statusOf(deps, row);
}

export const exportKey = (userId: string, versionId: string, exportId: string, format: ExportFormat) => `users/${userId}/exports/${versionId}/${exportId}.${format}`;

/** The worker's half: render, read back, store, record. Idempotent: a finished export is left alone. */
export async function runExport(deps: ExportDeps & { pdf: PdfRenderer; latex?: LatexCompiler; log: Logger }, payload: { exportId: string; userId: string }, lastAttempt: boolean): Promise<'rendered' | 'skipped' | 'failed'> {
  const identity: Identity = { userId: payload.userId, role: 'user' };
  const job = await deps.db.withUser(identity, async (tx) => {
    const event = await tx.selectFrom('export_events').selectAll().where('id', '=', payload.exportId).executeTakeFirst();
    if (!event || event.status !== 'pending') return null;
    const version = await tx.selectFrom('resume_versions').select(['content', 'created_at']).where('id', '=', event.resume_version_id).executeTakeFirstOrThrow();
    const resume = await tx.selectFrom('resumes').select(['doc_type', 'job_description_id']).where('id', '=', event.resume_id).executeTakeFirstOrThrow();
    const who = await tx.selectFrom('users as u').leftJoin('profiles as p', 'p.user_id', 'u.id').select(['u.first_name', 'u.last_name', 'u.email', 'p.phone', 'p.location']).where('u.id', '=', payload.userId).executeTakeFirstOrThrow();
    const jd = resume.job_description_id ? await tx.selectFrom('job_descriptions').select(['extracted', 'edited']).where('id', '=', resume.job_description_id).executeTakeFirst() : undefined;
    const jdLocation = ((jd?.edited as { location?: string } | null)?.location ?? (jd?.extracted as { location?: string | null } | null)?.location) || undefined;
    return { event, version, docType: resume.doc_type, who, jdLocation };
  });
  if (!job) return 'skipped';

  const { event } = job;
  const format = event.format as ExportFormat;
  try {
    const identityLine = { name: `${job.who.first_name} ${job.who.last_name}`.trim() || 'Your Name', email: job.who.email, ...(job.who.phone ? { phone: job.who.phone } : {}), ...(job.who.location ? { location: job.who.location } : {}) };
    const market = MARKETS.profiles[marketForLocation(job.jdLocation ?? job.who.location ?? undefined) ?? 'us'];
    const built: RenderModel = job.docType === 'cover_letter' ? letterModel(canonicalLetterSchema.parse(job.version.content), identityLine) : resumeModel(canonicalResumeSchema.parse(job.version.content), identityLine, market);
    const model: RenderModel = { ...built, paper: paperForLocation(job.who.location) };
    const template = TEMPLATES[event.template_slug] ?? TEMPLATES[DEFAULT_TEMPLATE]!;
    // A resume's PDF is its LaTeX render, byte for byte the pages its preview shows (toreview §111).
    const typeset = format === 'pdf' && job.docType === 'resume' && deps.latex ? await typesetPdf({ ...deps, latex: deps.latex }, payload.userId, event.resume_version_id, canonicalResumeSchema.parse(job.version.content), identityLine, market) : null;
    const bytes = typeset ?? (format === 'pdf' ? await deps.pdf.render(template.html(model), job.version.created_at) : format === 'docx' ? await renderDocx(model) : renderTxt(model));
    // A LaTeX PDF is read back like an upload (layout, headings, contact, its font: toreview §130);
    // the Chromium model's line-by-line read-back covers the other files.
    const typesetCheck = typeset ? await readBackTypeset(typeset, canonicalResumeSchema.parse(job.version.content).template) : null;
    const check = typeset ? null : await parseBack(model, format, bytes);
    // Every resume gets a receipt, a typeset one too. A read that fails makes no claim either way.
    const text = job.docType === 'resume' ? await Promise.resolve(readingText(format, bytes)).catch(() => null) : null;
    const receipt = job.docType === 'resume' && text !== null ? receiptOf(model, text) : undefined;
    const layout = check ?? (typesetCheck ? { kind: 'layout', ...typesetCheck } : null);
    const readBack = layout || receipt ? { ...layout, ...(receipt ? { receipt } : {}) } : null;
    const key = exportKey(payload.userId, event.resume_version_id, event.id, format);
    await deps.storage.write(deps.bucket, key, bytes, MIME[format]);
    await deps.db.withUser(identity, (tx) =>
      tx
        .updateTable('export_events')
        .set({ status: 'ready', object_key: key, size_bytes: bytes.length, ats_safe: check ? template.atsSafe && check.ok : (typesetCheck?.ok ?? null), parse_back: readBack ? JSON.stringify(readBack) : null, completed_at: new Date() })
        .where('id', '=', event.id)
        .where('status', '=', 'pending')
        .execute(),
    );
    deps.log.info({ event: 'export.rendered', format, engine: typeset ? 'latex' : 'chromium', bytes: bytes.length, atsSafe: check ? template.atsSafe && check.ok : null }, 'export rendered');
    return 'rendered';
  } catch (error) {
    if (!lastAttempt) throw error; // redelivered with backoff
    await deps.db.withUser(identity, (tx) =>
      tx.updateTable('export_events').set({ status: 'failed', error_message: 'We could not make that file. Try again.', completed_at: new Date() }).where('id', '=', event.id).where('status', '=', 'pending').execute(),
    );
    deps.log.warn({ event: 'export.failed', format, errorName: error instanceof Error ? error.name : typeof error }, 'export failed');
    return 'failed';
  }
}
