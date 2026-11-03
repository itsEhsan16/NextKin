import type { JdDraft, JdDraftPatch } from '@nextkin/shared/models/jd';
import { readJdSections } from '@nextkin/shared/jobs/jdSections';
import type { JdCreate } from '@nextkin/shared/schemas/jd';
import { sql } from 'kysely';

import type { AiGateway } from '../ai/gateway';
import { LlmError } from '../ai/types';
import type { KvCache } from '../cache/kv';
import type { Database, Identity } from '../db/database';
import { AppError, errors } from '../http/errors';
import { applyUrlHashOf, jobIdOf } from '../jobs/ids';
import { LinkError, parseLink, type LinkFailure } from '../links/address';
import { LinkReaderUnavailableError, type LinkReader } from '../links/client';
import type { Logger } from '../observability/logger';
import { enqueue } from '../outbox/outbox';
import { DOCUMENT_KINDS } from '../parsing/analyzer';
import { analyzeIsolated, type IsolationLimits } from '../parsing/pool';
import { UnreadableError, type Analysis } from '../parsing/types';
import { contentHash, extractJd, repairText, verify, type JdExtraction, type VerifiedJd } from '../pipeline/stages/extractJd';
import { JD_SECTIONS_TEMPLATE, structureJd } from '../pipeline/stages/jdSections';
import { JD_STRUCTURE_VERSION } from '@nextkin/shared/models/jdStructured';
import type { OcrPort } from '../ocr/tesseract';
import { toGrayPng } from '../ocr/png';
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
 * - **create** also takes a link. The link reader service reads the page, and this process never
 *   touches the URL (toreview §144.3). A site that refuses is taken at its word: the draft fails with
 *   a plain reason, and nothing is made up to fill the gap.
 */

export const JD_TEMPLATE = 'jd.extract';
const MAX_TEXT = 20000;

export const JD_FAILURE = {
  unreadable: 'We couldn’t read text in this file. Paste the description instead.',
  provider: 'We couldn’t read this job description right now. Try again in a moment.',
} as const;

const CHECK_LINK = 'We can’t read that address. Check the link, or paste the description instead.';
const SITE_REFUSED = 'This site doesn’t let us read its pages. Open the job and paste its description here.';
const NO_ANSWER = 'We couldn’t reach that page. Try again, or paste the description instead.';
const NOT_A_JOB = 'We couldn’t find a job on that page. It may be behind a sign-in. Paste the description instead.';

/** What the candidate is told about a link we could not read. Each says what they can do next. */
export const LINK_FAILURE: Record<LinkFailure, string> = {
  invalid: CHECK_LINK,
  private: CHECK_LINK,
  robots: SITE_REFUSED,
  refused: SITE_REFUSED,
  gone: 'This job’s page no longer exists. It may have closed.',
  unsupported: 'That link opens a file. Download it and upload it here instead.',
  too_large: NO_ANSWER,
  timeout: NO_ANSWER,
  unreachable: NO_ANSWER,
  empty: NOT_A_JOB,
};

/** Links one candidate may have read in an hour: the reader must not become a free fetch service. */
export const LINKS_PER_HOUR = 30;
/** A link read this recently is answered from the draft we already hold. */
const LINK_REUSE_DAYS = 7;

export async function createJd(db: Database, identity: Identity, input: JdCreate, correlationId: string | null): Promise<JdDraft> {
  if (input.source === 'job') return jdForListing(db, identity, input.jobId, input.details);
  if (input.source === 'link') return jdFromLink(db, identity, input.url, input.details, correlationId);
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

/** Starts reading a link. The address is checked here, so a bad one is refused before any work. */
async function jdFromLink(db: Database, identity: Identity, raw: string, details: JdDraftPatch | undefined, correlationId: string | null): Promise<JdDraft> {
  let url: URL;
  try {
    url = parseLink(raw);
  } catch (error) {
    if (error instanceof LinkError) throw new AppError('UNREADABLE_LINK', LINK_FAILURE[error.reason]);
    throw error;
  }
  const jobId = jobIdOf(applyUrlHashOf(url.href));
  return db.withUser(identity, async (tx) => {
    await requireAiConsent(tx, identity.userId);
    const known = await tx
      .selectFrom('job_descriptions')
      .select(COLUMNS)
      .where('user_id', '=', identity.userId)
      .where('source', '=', 'link')
      .where('job_id', '=', jobId)
      .where('status', '=', 'ready')
      .where('created_at', '>', sql<Date>`now() - make_interval(days => ${LINK_REUSE_DAYS})`)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    if (known && !details) return toDraft(known as Row);
    const recent = await tx
      .selectFrom('job_descriptions')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('user_id', '=', identity.userId)
      .where('source', '=', 'link')
      .where('created_at', '>', sql<Date>`now() - interval '1 hour'`)
      .executeTakeFirstOrThrow();
    if (Number(recent.n) >= LINKS_PER_HOUR) throw errors.rateLimited(3600);
    const row = await tx
      .insertInto('job_descriptions')
      .values({ user_id: identity.userId, source: 'link', raw_text: '', source_url: url.href, job_id: jobId, status: 'extracting', edited: details ? JSON.stringify(details) : null })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    await enqueue(tx, { queue: 'generation-standard', groupId: `${identity.userId}#jd`, type: 'jd.extract', payload: { jdId: row.id, userId: identity.userId }, correlationId });
    return toDraft(row as Row);
  });
}

/**
 * A JD read before the structured reading (toreview §153) is read again once, in the background,
 * from the text it already holds: no page or file is fetched twice. `structure_version = 1` marks it
 * queued, so it is asked for once however often the page is opened.
 */
export const getJd = (db: Database, identity: Identity, id: string): Promise<JdDraft> =>
  db.withUser(identity, async (tx) => {
    const row = await findRow(tx, id);
    if (row.status === 'ready' && row.source !== 'job' && row.structure_version === null && row.raw_text.trim()) {
      const marked = await tx.updateTable('job_descriptions').set({ structure_version: 1 }).where('id', '=', id).where('structure_version', 'is', null).executeTakeFirst();
      if (Number(marked.numUpdatedRows) > 0) {
        await enqueue(tx, { queue: 'generation-standard', groupId: `${identity.userId}#jd`, type: 'jd.extract', payload: { jdId: id, userId: identity.userId, upgrade: true }, correlationId: null });
      }
    }
    return toDraft(row);
  });

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
  /** Links (toreview §144.3): the reader service. Absent, a link fails with a plain message. */
  links?: LinkReader;
  /** File JDs (P7): read the scanned upload. Absent where only pastes are served. */
  files?: { storage: StoragePort; maxBytes: number; limits?: Partial<IsolationLimits>; ocr?: () => Promise<OcrPort> };
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

/** A job description names some of what the job asks. A page with none of it is something else. */
const looksLikeAJob = (jd: VerifiedJd): boolean => jd.requiredSkills.length + jd.preferredSkills.length + jd.tools.length + jd.responsibilities.length >= 2;

/** Scanned pages, read by OCR (toreview §153), as the resume upload does. */
async function withOcr(deps: JdExtractDeps, analysis: Pick<Analysis, 'text' | 'images'>): Promise<string> {
  if (analysis.images.length === 0 || !deps.files?.ocr) return analysis.text;
  const ocr = await deps.files.ocr();
  const pages: string[] = [];
  for (const image of analysis.images) pages.push((await ocr.recognise(toGrayPng(image))).text);
  return [analysis.text, ...pages].filter(Boolean).join('\n\n');
}

/**
 * Reading a JD again from its stored text (toreview §153). The row stays ready and usable
 * throughout; success adds the structure, and a failure leaves the old reading as it was.
 */
async function upgradeJd(deps: JdExtractDeps, message: { jdId: string; userId: string; correlationId: string | null }, lastAttempt: boolean): Promise<'ready' | 'failed' | 'skipped'> {
  const identity: Identity = { userId: message.userId, role: 'user' };
  const found = await deps.db.withUser(identity, (tx) => tx.selectFrom('job_descriptions').select(['status', 'raw_text', 'structure_version', 'extracted']).where('id', '=', message.jdId).executeTakeFirst());
  if (!found || found.status !== 'ready' || found.structure_version !== 1 || !found.raw_text.trim()) return 'skipped';
  try {
    const prompt = await deps.db.withSystem('jd: read the extraction prompt', (tx) => activePrompt(tx, JD_TEMPLATE));
    const closesAt = (found.extracted as { closesAt?: string } | null)?.closesAt;
    const { jd } = await extractJd({ gateway: deps.gateway, cache: deps.cache, prompt, text: found.raw_text, context: { userId: message.userId, correlationId: message.correlationId, promptVersionId: prompt.id }, ...(closesAt ? { closesAt } : {}) });
    await deps.db.withUser(identity, (tx) =>
      tx.updateTable('job_descriptions').set({ extracted: JSON.stringify({ ...jd, ...(closesAt ? { closesAt } : {}) }), stats: JSON.stringify(jd.stats), structure_version: JD_STRUCTURE_VERSION }).where('id', '=', message.jdId).where('structure_version', '=', 1).execute(),
    );
    deps.log.info({ event: 'jd.upgraded', kept: jd.stats.kept, dropped: jd.stats.dropped }, 'job description read again into the structure');
    return 'ready';
  } catch (error) {
    const transient = error instanceof LlmError ? error.retryable : true;
    if (transient && !lastAttempt) throw error;
    deps.log.warn({ event: 'jd.upgrade_failed', err: error instanceof Error ? error.message : String(error) }, 'job description left as it was read');
    return 'failed';
  }
}

/** The extraction job. Idempotent: a JD that is no longer extracting is left alone. */
export async function runJdExtract(deps: JdExtractDeps, message: { jdId: string; userId: string; correlationId: string | null; upgrade?: boolean }, lastAttempt: boolean): Promise<'ready' | 'failed' | 'skipped'> {
  if (message.upgrade) return upgradeJd(deps, message, lastAttempt);
  const identity: Identity = { userId: message.userId, role: 'user' };
  const found = await deps.db.withUser(identity, (tx) =>
    tx
      .selectFrom('job_descriptions as j')
      .leftJoin('uploads as u', 'u.id', 'j.upload_id')
      .select(['j.id', 'j.status', 'j.source', 'j.raw_text', 'j.source_url', 'u.bucket', 'u.object_key', 'u.status as upload_status'])
      .where('j.id', '=', message.jdId)
      .executeTakeFirst(),
  );
  if (!found || found.status !== 'extracting') return 'skipped';

  const finish = (set: Record<string, unknown>) =>
    deps.db.withUser(identity, (tx) => tx.updateTable('job_descriptions').set(set).where('id', '=', message.jdId).where('status', '=', 'extracting').execute());
  const fail = async (text: string) => {
    await finish({ status: 'failed', error_message: text, stage: null });
    return 'failed' as const;
  };
  const stage = (to: 'reading' | 'understanding' | 'checking') => finish({ stage: to });

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
    let closesAt: string | undefined;
    if (found.source !== 'paste') await stage('reading');
    if (found.source === 'link') {
      if (!deps.links || !found.source_url) return fail(NO_ANSWER);
      const reading = await deps.links.read(found.source_url);
      text = repairText(reading.text).slice(0, MAX_TEXT);
      closesAt = reading.closesAt;
    }
    if (found.source === 'file') {
      if (!deps.files || !found.bucket || !found.object_key) return fail(JD_FAILURE.unreadable);
      const bytes = await deps.files.storage.read(found.bucket, found.object_key, deps.files.maxBytes);
      const analysis = await analyzeIsolated(bytes, { allowed: DOCUMENT_KINDS, limits: deps.files.limits });
      // Hidden text never reaches the model (G9): the analyzer returns visible text only.
      text = repairText(await withOcr(deps, analysis)).slice(0, MAX_TEXT);
      if (text.replace(/\s+/g, '').length < 40) return fail(JD_FAILURE.unreadable);
    }
    await stage('understanding');
    const prompt = await deps.db.withSystem('jd: read the extraction prompt', (tx) => activePrompt(tx, JD_TEMPLATE));
    const { jd, cached } = await extractJd({ gateway: deps.gateway, cache: deps.cache, prompt, text, context: { userId: message.userId, correlationId: message.correlationId, promptVersionId: prompt.id }, ...(closesAt ? { closesAt } : {}) });
    // The model is the last check on a link: a sign-in page or a closed posting has text, not a job.
    if (found.source === 'link' && !looksLikeAJob(jd)) return fail(NOT_A_JOB);
    await stage('checking');
    // The structure places every line, so the separate section grouping (§129) runs only for a
    // reading without one.
    const reading = jd.structured ? undefined : await sectionsByModel(deps, text, jd.title, message);
    await finish({
      status: 'ready',
      stage: null,
      structure_version: jd.structured ? JD_STRUCTURE_VERSION : null,
      raw_text: text,
      extracted: JSON.stringify({ ...jd, ...(reading ? { reading } : {}), ...(closesAt ? { closesAt } : {}) }),
      stats: JSON.stringify(jd.stats),
      language: jd.language === 'other' ? null : jd.language,
      content_hash: contentHash(text),
    });
    deps.log.info({ event: 'jd.extracted', cached, kept: jd.stats.kept, dropped: jd.stats.dropped }, 'job description extracted');
    return 'ready';
  } catch (error) {
    if (error instanceof UnreadableError) return fail(JD_FAILURE.unreadable);
    if (error instanceof LinkError) return fail(LINK_FAILURE[error.reason]);
    if (error instanceof LinkReaderUnavailableError) {
      if (lastAttempt) return fail(NO_ANSWER);
      throw error;
    }
    const transient = error instanceof LlmError ? error.retryable : true;
    if (transient && !lastAttempt) throw error;
    return fail(JD_FAILURE.provider);
  }
}

type Listing = NonNullable<Awaited<ReturnType<typeof findListing>>>['normalized'];

/**
 * A listing as the extraction would read it: each field quotes the line the stored text gives it.
 * Requirement lines that state years are experience; the rest are kept as extras, never lost.
 */
function listingReading(n: Listing): JdExtraction {
  const said = (text: string | null | undefined) => (text?.trim() ? { text: text.trim(), quote: text.trim() } : null);
  const skills = (names: readonly string[], importance: 'required' | 'preferred', line: string) =>
    names.map((name) => ({ name, quote: line, category: 'other' as const, importance }));
  const years = (line: string) => /\b\d{1,2}\s*\+?\s*(?:-|to|–)?\s*\d{0,2}\s*(?:years?|yrs?)\b|\bfreshers?\b/i.test(line);
  return {
    language: 'en',
    title: said(n.title),
    company: said(n.company),
    department: null,
    industry: null,
    employmentType: null,
    seniority: n.experienceLevel ? { value: n.experienceLevel, quote: null } : null,
    openings: null,
    referenceId: null,
    summary: null,
    locations: n.location?.trim() ? [{ text: n.location.trim(), quote: n.location.trim(), city: null, region: null, country: null }] : [],
    workModes: [],
    schedule: [],
    pay: [],
    negotiable: null,
    experience: n.requirements.filter(years).map((line) => ({ text: line, quote: line })),
    responsibilities: n.responsibilities.slice(0, 30).map((line) => ({ text: line, quote: line, group: null })),
    skills: [
      ...skills(n.requiredSkills, 'required', `Skills: ${n.requiredSkills.join(', ')}`),
      ...skills(n.preferredSkills, 'preferred', `Nice to have: ${n.preferredSkills.join(', ')}`),
    ],
    education: [],
    languages: [],
    benefits: [],
    eligibility: [],
    companyAbout: [],
    website: null,
    application: [],
    extras: [...(n.description?.trim() ? [n.description.trim()] : []), ...n.requirements.filter((l) => !years(l))].slice(0, 20).map((line) => ({ text: line.slice(0, 200), quote: line.slice(0, 400) })),
    issues: [],
  };
}

/** The listing in the structure; a listing that won't validate is shown the old way, never blocked. */
function listingStructure(rawText: string, n: Listing) {
  try {
    return verify(rawText, listingReading(n)).structured;
  } catch {
    return undefined;
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
      // The listing's own fields, placed in the structure by code (toreview §153): no model call.
      structured: listingStructure(rawText, n),
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
        structure_version: extracted.structured ? JD_STRUCTURE_VERSION : null,
        job_id: jobId,
        jobs_cache_id: found.cacheId,
      })
      .returning(COLUMNS)
      .executeTakeFirstOrThrow();
    return toDraft(row as Row);
  });
}
