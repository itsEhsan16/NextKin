import type { ProfileDraft } from '@nextkin/shared/models/profile';
import type { ApplyChoices, ResumeParse } from '@nextkin/shared/schemas/uploads';
import { sql, type Selectable } from 'kysely';
import type { AiGateway } from '../ai/gateway';
import { LlmError } from '../ai/types';
import type { Database, Identity } from '../db/database';
import type { ResumeParses } from '../db/types.generated';
import { AppError, errors } from '../http/errors';
import type { Logger } from '../observability/logger';
import type { OcrPort } from '../ocr/tesseract';
import { toGrayPng } from '../ocr/png';
import { enqueue } from '../outbox/outbox';
import { crossCheck, extractResume } from '../parsing/extract';
import { splitHeader } from '../parsing/header';
import { analyzeIsolated, type IsolationLimits } from '../parsing/pool';
import { UnreadableError } from '../parsing/types';
import { generationGroup } from '../queue/envelope';
import type { StoragePort } from '../storage/storage';
import { applyDraft } from './profile';
import { requireAiConsent } from './consent';

/**
 * Resume parsing (spec §7.4, §11 `/api/v1/resume-parse`; ImBackendImplementationPlan P7-04 to P7-07).
 *
 * waiting_scan → queued → reading (isolated analyzer; OCR for scans) → extracting (the model, on
 * visible text only) → verifying (the deterministic cross-check) → ready, with a draft. The draft is
 * never applied here: the user reviews it and confirms (`apply`), or abandons it and the profile is
 * unchanged byte for byte.
 */

export type ParseRow = Selectable<ResumeParses>;

const FAILURE = {
  unreadable: 'We couldn’t read this file. Upload a PDF, Word (DOCX) or plain-text resume.',
  no_text: 'We couldn’t find any text in this file. If it is a photo or scan, try a clearer copy.',
  provider: 'We couldn’t finish reading your resume. Try again in a moment.',
} as const;

export const toParse = (row: ParseRow): ResumeParse => ({
  id: row.id,
  uploadId: row.upload_id,
  status: row.status as ResumeParse['status'],
  ...(row.draft ? { draft: row.draft as ProfileDraft } : {}),
  findings: (row.findings ?? {}) as ResumeParse['findings'],
  ...(row.error_message ? { error: row.error_message } : {}),
  ...(row.error_code ? { errorCode: row.error_code } : {}),
});

export async function startParse(db: Database, identity: Identity, uploadId: string, correlationId: string | null): Promise<ResumeParse> {
  return db.withUser(identity, async (tx) => {
    await requireAiConsent(tx, identity.userId); // P12-12: the parse reads the resume with a model
    const upload = /^[0-9a-f-]{36}$/i.test(uploadId) ? await tx.selectFrom('uploads').selectAll().where('id', '=', uploadId).executeTakeFirst() : undefined;
    if (!upload) throw errors.notFound('upload');
    if (upload.purpose !== 'resume') throw errors.validation({ uploadId: 'not a resume upload' }, 'That upload is not a resume.');
    if (upload.status === 'infected' || upload.status === 'failed' || upload.status === 'deleted') throw new AppError('UNREADABLE_FILE', FAILURE.unreadable);
    if (upload.status === 'pending') throw errors.conflict('Confirm the upload first.');
    const clean = upload.status === 'clean';
    const row = await tx
      .insertInto('resume_parses')
      .values({ user_id: identity.userId, upload_id: upload.id, status: clean ? 'queued' : 'waiting_scan' })
      .returningAll()
      .executeTakeFirstOrThrow();
    if (clean) await enqueue(tx, { queue: 'generation-standard', groupId: generationGroup(identity.userId, row.id), type: 'resume.parse', payload: { parseId: row.id, userId: identity.userId }, correlationId });
    return toParse(row);
  });
}

export async function getParse(db: Database, identity: Identity, id: string): Promise<ResumeParse> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw errors.notFound('resume parse');
  const row = await db.withUser(identity, (tx) => tx.selectFrom('resume_parses').selectAll().where('id', '=', id).executeTakeFirst());
  if (!row) throw errors.notFound('resume parse');
  return toParse(row);
}

/** The user confirms the draft, section by section. Nothing reaches the profile before this. */
export async function applyParse(db: Database, identity: Identity, id: string, choices: ApplyChoices) {
  const parse = await getParse(db, identity, id);
  if (parse.status !== 'ready' || !parse.draft) throw errors.conflict('This resume has not finished reading.');
  return applyDraft(db, identity, parse.draft, choices);
}

export interface ParseRunDeps {
  db: Database;
  storage: StoragePort;
  gateway: AiGateway;
  /** Created on first use: most documents never need it. */
  ocr: () => Promise<OcrPort>;
  log: Logger;
  maxBytes: number;
  limits?: Partial<IsolationLimits>;
}

async function setStatus(db: Database, identity: Identity, id: string, status: ParseRow['status'], extra: Record<string, unknown> = {}) {
  await db.withUser(identity, (tx) => tx.updateTable('resume_parses').set({ status, ...extra }).where('id', '=', id).execute());
}

/** The parse (worker, as the owner). Transient provider failures are thrown back for a retry. */
export async function runParse(deps: ParseRunDeps, message: { parseId: string; userId: string; correlationId: string | null }, lastAttempt: boolean): Promise<'ready' | 'failed' | 'skipped'> {
  const identity: Identity = { userId: message.userId, role: 'user' };
  const found = await deps.db.withUser(identity, (tx) =>
    tx
      .selectFrom('resume_parses as p')
      .innerJoin('uploads as u', 'u.id', 'p.upload_id')
      .select(['p.id', 'p.status', 'p.attempt', 'u.bucket', 'u.object_key', 'u.status as upload_status'])
      .where('p.id', '=', message.parseId)
      .executeTakeFirst(),
  );
  if (!found || found.status === 'ready' || found.status === 'failed' || found.status === 'waiting_scan') return 'skipped';
  if (found.upload_status !== 'clean') return 'skipped'; // only a clean scan releases parsing (P7-03)

  const fail = async (code: string, text: string) => {
    await setStatus(deps.db, identity, message.parseId, 'failed', { error_code: code, error_message: text, finished_at: sql`now()` });
    deps.log.info({ event: 'resume_parse.finished', outcome: 'failed', code }, 'resume parse failed');
    return 'failed' as const;
  };

  try {
    await setStatus(deps.db, identity, message.parseId, 'reading', { attempt: found.attempt + 1, started_at: sql`coalesce(started_at, now())` });
    const bytes = await deps.storage.read(found.bucket, found.object_key, deps.maxBytes);
    const analysis = await analyzeIsolated(bytes, { limits: deps.limits });
    let text = analysis.text;
    if (analysis.images.length > 0) {
      const ocr = await deps.ocr();
      const pages: string[] = [];
      for (const image of analysis.images) pages.push((await ocr.recognise(toGrayPng(image))).text);
      text = [text, ...pages].filter(Boolean).join('\n\n');
    }
    if (text.replace(/\s+/g, '').length < 40) return fail('unreadable', FAILURE.no_text);

    await setStatus(deps.db, identity, message.parseId, 'extracting');
    // The header (name, contact, links) is read by code and never sent to the model (G5; §111).
    const { header, headline, body } = splitHeader(text, analysis.links ?? []);
    const extraction = await extractResume(deps.gateway, body, { userId: message.userId, correlationId: message.correlationId });
    await setStatus(deps.db, identity, message.parseId, 'verifying');
    const checked = crossCheck(extraction, text);
    const verified = { ...checked, document: { ...checked.document, ...(header ? { header } : {}), ...(headline && !checked.document.headline ? { headline } : {}) } };
    const findings = { kind: analysis.kind, pages: analysis.facts.pages, ocr: analysis.images.length > 0, hidden: analysis.hidden, rejected: verified.rejected, flagged: verified.flagged, ...(analysis.facts.layout ? { layout: analysis.facts.layout } : {}) };
    await setStatus(deps.db, identity, message.parseId, 'ready', { draft: JSON.stringify(verified.draft), document: JSON.stringify(verified.document), findings: JSON.stringify(findings), finished_at: sql`now()` });
    deps.log.info({ event: 'resume_parse.finished', outcome: 'ready', kind: analysis.kind, ocr: findings.ocr, hidden: analysis.hidden.length, rejected: verified.rejected.length }, 'resume parsed');
    return 'ready';
  } catch (error) {
    if (error instanceof UnreadableError) return fail('unreadable', error.code === 'timeout' ? error.message : FAILURE.unreadable);
    const transient = error instanceof LlmError ? error.retryable : true;
    if (transient && !lastAttempt) throw error;
    return fail('provider', FAILURE.provider);
  }
}
