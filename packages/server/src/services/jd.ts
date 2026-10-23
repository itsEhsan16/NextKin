import type { JdDraft, JdDraftPatch } from '@nextkin/shared/models/jd';
import { readJdSections } from '@nextkin/shared/jobs/jdSections';
import type { JdCreate } from '@nextkin/shared/schemas/jd';

import type { AiGateway } from '../ai/gateway';
import { LlmError } from '../ai/types';
import type { KvCache } from '../cache/kv';
import type { Database, Identity } from '../db/database';
import { AppError, errors } from '../http/errors';
import type { Logger } from '../observability/logger';
import { enqueue } from '../outbox/outbox';
import { DOCUMENT_KINDS } from '../parsing/analyzer';
import { analyzeIsolated, type IsolationLimits } from '../parsing/pool';
import { UnreadableError } from '../parsing/types';
import { contentHash, extractJd, repairText, type VerifiedJd } from '../pipeline/stages/extractJd';
import { JD_SECTIONS_TEMPLATE, structureJd } from '../pipeline/stages/jdSections';
import type { StoragePort } from '../storage/storage';
import { findListing } from './jobs';
import { activePrompt } from './prompts';
import { requireAiConsent } from './consent';
import { COLUMNS, findRow, toDraft, type Row } from './jdDraft';

export { toDraft } from './jdDraft';

/**
 * Job descriptions (spec §11 `/api/v1/jd`; ImBackendImplementationPlan P9-01; V2 §7.5).
 *
 * - **create** takes a paste or a scanned upload and starts the extraction as a job; the client
 *   awaits it by polling `get` until the draft is `ready` (near-synchronous, under 30 s).
 * - **update** stores the user's corrections beside the extraction; generation reads the merge, so
 *   what the user confirmed is what the run uses.
 * - No URL is ever fetched (D-17); a link stays on the client.
 */

export const JD_TEMPLATE = 'jd.extract';
const MAX_TEXT = 20000;

export const JD_FAILURE = {
  unreadable: 'We couldn’t read text in this file. Paste the description instead.',
  provider: 'We couldn’t read this job description right now. Try again in a moment.',
} as const;

export async function createJd(db: Database, identity: Identity, input: JdCreate, correlationId: string | null): Promise<JdDraft> {
  if (input.source === 'job') return jdForListing(db, identity, input.jobId, input.details);
  return db.withUser(identity, async (tx) => {
    // P12-12: reading a JD from text or a file is AI work (a listing's JD is not).
    await requireAiConsent(tx, identity.userId);
    let s3Key: string | null = null;
    if (input.source === 'file') {
      const upload = await tx.selectFrom('uploads').select(['object_key', 'status', 'purpose']).where('id', '=', input.uploadId).executeTakeFirst();
      if (!upload || upload.purpose !== 'jd') throw errors.notFound('upload');
      if (upload.status === 'infected' || upload.status === 'failed') throw new AppError('UNREADABLE_FILE', 'This file can’t be read. Paste the description instead.');
      s3Key = upload.object_key;
    }
    const row = await tx
      .insertInto('job_descriptions')
      .values({
        user_id: identity.userId,
        source: input.source,
        raw_text: input.source === 'paste' ? repairText(input.text).slice(0, MAX_TEXT) : '',
        s3_key: s3Key,
        upload_id: input.source === 'file' ? input.uploadId : null,
        status: 'extracting',
        edited: input.details ? JSON.stringify(input.details) : null,
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    await enqueue(tx, {
      queue: 'generation-standard',
      groupId: `${identity.userId}#jd`,
      type: 'jd.extract',
      payload: { jdId: row.id, userId: identity.userId },
      correlationId,
    });
    return toDraft(row as Row);
  });
}

export const getJd = (db: Database, identity: Identity, id: string): Promise<JdDraft> => db.withUser(identity, async (tx) => toDraft(await findRow(tx, id)));

/**
 * V2 §7.5: "extraction failures return a clear message and allow manual entry of the structured
 * fields". A JD whose reading failed becomes usable once the user has entered a title and at least
 * one skill or responsibility themselves; what they typed is then what generation reads.
 */
const enteredByHand = (e: JdDraftPatch) => Boolean(e.title?.trim()) && Boolean(e.requiredSkills?.length || e.preferredSkills?.length || e.responsibilities?.length);

export async function updateJd(db: Database, identity: Identity, id: string, patch: JdDraftPatch): Promise<JdDraft> {
  return db.withUser(identity, async (tx) => {
    const row = await findRow(tx, id);
    const edited = { ...((row.edited ?? {}) as JdDraftPatch), ...patch };
    const manual = row.status === 'failed' && enteredByHand(edited);
    const updated = await tx
      .updateTable('job_descriptions')
      .set({ edited: JSON.stringify(edited), ...(manual ? { status: 'ready', error_message: null } : {}) })
      .where('id', '=', id)
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    return toDraft(updated as Row);
  });
}

export interface JdExtractDeps {
  db: Database;
  gateway: AiGateway;
  cache: KvCache;
  log: Logger;
  /** File JDs (P7): read the scanned upload. Absent where only pastes are served. */
  files?: { storage: StoragePort; maxBytes: number; limits?: Partial<IsolationLimits> };
}

/**
 * The JD's sections by a model, only when the rules can't read them (toreview §129). Best effort:
 * a failure, or a grouping that is still weak, leaves the page to the rules' reading, and never
 * fails the extraction.
 */
async function sectionsByModel(deps: JdExtractDeps, text: string, title: string | null, message: { userId: string; correlationId: string | null }) {
  if (readJdSections(text, title ?? undefined).confidence === 'strong') return undefined;
  try {
    const prompt = await deps.db.withSystem('jd: read the sections prompt', (tx) => activePrompt(tx, JD_SECTIONS_TEMPLATE));
    const { reading, dropped, cached } = await structureJd({ gateway: deps.gateway, cache: deps.cache, prompt, text, context: { userId: message.userId, correlationId: message.correlationId, promptVersionId: prompt.id } });
    deps.log.info({ event: 'jd.sections', cached, sections: reading.sections.length, dropped, confidence: reading.confidence }, 'job description grouped into sections');
    return reading.confidence === 'strong' ? reading : undefined;
  } catch (error) {
    deps.log.warn({ event: 'jd.sections_failed', err: error instanceof Error ? error.message : String(error) }, 'job description sections left to the rules');
    return undefined;
  }
}

/** The extraction job. Idempotent: a JD that is no longer extracting is left alone. */
export async function runJdExtract(deps: JdExtractDeps, message: { jdId: string; userId: string; correlationId: string | null }, lastAttempt: boolean): Promise<'ready' | 'failed' | 'skipped'> {
  const identity: Identity = { userId: message.userId, role: 'user' };
  const found = await deps.db.withUser(identity, (tx) =>
    tx
      .selectFrom('job_descriptions as j')
      .leftJoin('uploads as u', 'u.id', 'j.upload_id')
      .select(['j.id', 'j.status', 'j.source', 'j.raw_text', 'u.bucket', 'u.object_key', 'u.status as upload_status'])
      .where('j.id', '=', message.jdId)
      .executeTakeFirst(),
  );
  if (!found || found.status !== 'extracting') return 'skipped';

  const finish = (set: Record<string, unknown>) =>
    deps.db.withUser(identity, (tx) => tx.updateTable('job_descriptions').set(set).where('id', '=', message.jdId).where('status', '=', 'extracting').execute());
  const fail = async (text: string) => {
    await finish({ status: 'failed', error_message: text });
    return 'failed' as const;
  };

  // Only a clean scan releases a file (P7-03). Still scanning: let the message come back.
  if (found.source === 'file' && found.upload_status !== 'clean') {
    if (found.upload_status === 'pending' || found.upload_status === 'scanning') {
      if (lastAttempt) return fail(JD_FAILURE.unreadable);
      throw new Error('the upload is still being scanned');
    }
    return fail(JD_FAILURE.unreadable);
  }

  try {
    let text = found.raw_text;
    if (found.source === 'file') {
      if (!deps.files || !found.bucket || !found.object_key) return fail(JD_FAILURE.unreadable);
      const bytes = await deps.files.storage.read(found.bucket, found.object_key, deps.files.maxBytes);
      const analysis = await analyzeIsolated(bytes, { allowed: DOCUMENT_KINDS, limits: deps.files.limits });
      // Hidden text never reaches the model (G9): the analyzer returns visible text only.
      text = repairText(analysis.text).slice(0, MAX_TEXT);
      if (text.replace(/\s+/g, '').length < 40) return fail(JD_FAILURE.unreadable);
    }
    const prompt = await deps.db.withSystem('jd: read the extraction prompt', (tx) => activePrompt(tx, JD_TEMPLATE));
    const { jd, cached } = await extractJd({ gateway: deps.gateway, cache: deps.cache, prompt, text, context: { userId: message.userId, correlationId: message.correlationId, promptVersionId: prompt.id } });
    const reading = await sectionsByModel(deps, text, jd.title, message);
    await finish({
      status: 'ready',
      raw_text: text,
      extracted: JSON.stringify(reading ? { ...jd, reading } : jd),
      stats: JSON.stringify(jd.stats),
      language: jd.language === 'other' ? null : jd.language,
      content_hash: contentHash(text),
    });
    deps.log.info({ event: 'jd.extracted', cached, kept: jd.stats.kept, dropped: jd.stats.dropped }, 'job description extracted');
    return 'ready';
  } catch (error) {
    if (error instanceof UnreadableError) return fail(JD_FAILURE.unreadable);
    const transient = error instanceof LlmError ? error.retryable : true;
    if (transient && !lastAttempt) throw error;
    return fail(JD_FAILURE.provider);
  }
}

/**
 * A JD read from a listing on NextKin (P11; `jd.forJob`, `extract({source: 'job'})`). The listing's
 * own fields are the extraction, with no model call: its title, company, place, level, skill lists
 * and responsibilities. The text stored carries a skills line, so each requirement still quotes
 * its source (P9-01). One draft per user and listing is reused, so the comparison and the run that
 * follows read the same JD.
 */
export async function jdForListing(db: Database, identity: Identity, jobId: string, details?: JdDraftPatch): Promise<JdDraft> {
  return db.withUser(identity, async (tx) => {
    const known = await tx
      .selectFrom('job_descriptions')
      .select(COLUMNS)
      .where('user_id', '=', identity.userId)
      .where('job_id', '=', jobId)
      .where('status', '=', 'ready')
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    if (known && !details) return toDraft(known as Row);
    const found = await findListing(tx, identity.userId, jobId);
    if (!found) throw errors.notFound('job');
    const n = found.normalized;
    const rawText = [
      `${n.title} at ${n.company}`,
      n.location,
      n.description,
      ...n.responsibilities,
      ...n.requirements,
      n.requiredSkills.length ? `Skills: ${n.requiredSkills.join(', ')}` : '',
      n.preferredSkills.length ? `Nice to have: ${n.preferredSkills.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, MAX_TEXT);
    const extracted: VerifiedJd = {
      title: n.title,
      company: n.company,
      location: n.location || null,
      experienceLevel: n.experienceLevel,
      employmentType: n.employmentType,
      domain: null,
      language: 'en',
      requiredSkills: n.requiredSkills,
      preferredSkills: n.preferredSkills,
      tools: [],
      responsibilities: n.responsibilities.slice(0, 30),
      stats: { kept: n.requiredSkills.length + n.preferredSkills.length, dropped: 0, droppedItems: [] },
    };
    const row = await tx
      .insertInto('job_descriptions')
      .values({
        user_id: identity.userId,
        source: 'job',
        raw_text: rawText,
        status: 'ready',
        extracted: JSON.stringify(extracted),
        edited: details ? JSON.stringify(details) : null,
        stats: JSON.stringify(extracted.stats),
        content_hash: contentHash(rawText),
        language: 'en',
        job_id: jobId,
        jobs_cache_id: found.cacheId,
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    return toDraft(row as Row);
  });
}
