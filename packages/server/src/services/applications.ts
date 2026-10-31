import { createHash } from 'node:crypto';

import type { JdDraft } from '@nextkin/shared/models/jd';
import type { Application, ApplicationAnswer, ApplicationAsk, ApplicationStatus, ApplicationTarget, ApplicationWithJob, Job } from '@nextkin/shared/models/job';
import { jobSchema } from '@nextkin/shared/schemas/job';
import { sql } from 'kysely';

import type { Database, Identity, Tx } from '../db/database';
import { errors } from '../http/errors';
import { jobIdOf } from '../jobs/ids';
import { toClientJob } from '../jobs/toJob';
import { findListing } from './jobs';
import { COLUMNS, toDraft, type Row } from './jdDraft';

/**
 * Applications (owner, 2026-10-31; changes D-05). NextKin never submits an application, so a row
 * records what the candidate told us, and nothing an employer does ever moves it.
 *
 * "Did you apply?" is asked after a download or a trip to the employer's page, straight away. A
 * finished run for a job also starts an ask, for the next time the app opens (`RUN_DELAY_MINUTES`
 * keeps it from landing on the run's own ready screen). "Not yet" asks once more a day later, then
 * stops. A second download never restarts the count.
 */

export const RUN_DELAY_MINUTES = 30;
const ASK_AGAIN_DAYS = 1;
const MAX_ASKS_LISTED = 3;
/** What a job with no company in its text is called. */
export const UNNAMED_COMPANY = 'Company not named';

/** The kinds of run that produce something to apply with. */
const APPLYING_KINDS: readonly string[] = ['resume', 'cover_letter', 'zero_resume'];

interface ApplicationRow {
  id: string;
  job_id: string;
  resume_id: string | null;
  status: string;
  job: unknown;
  ask_after: Date | null;
  asks_left: number;
  applied_at: Date | null;
  interview_at: Date | null;
}

const ROW = ['id', 'job_id', 'resume_id', 'status', 'job', 'ask_after', 'asks_left', 'applied_at', 'interview_at'] as const;

const toApplication = (row: ApplicationRow): Application => ({
  id: row.id,
  jobId: row.job_id,
  status: row.status as ApplicationStatus,
  appliedAt: row.applied_at!.toISOString(),
  ...(row.interview_at ? { interviewAt: row.interview_at.toISOString() } : {}),
  ...(row.resume_id ? { resumeId: row.resume_id } : {}),
});

const storedJob = (row: Pick<ApplicationRow, 'job'>): Job => jobSchema.parse(row.job) as Job;

const toAsk = (row: ApplicationRow): ApplicationAsk => {
  const job = storedJob(row);
  return { id: row.id, jobId: row.job_id, title: job.title, company: job.company };
};

/** The id of a job with no listing: stable for the description it came from. */
export const jobIdOfJd = (jdId: string): string => jobIdOf(createHash('sha256').update(`jd:${jdId}`).digest('hex'));

/** A job as the apps model it, from a job description the candidate gave us. */
export function jobFromDraft(draft: JdDraft, id: string): Job {
  return {
    id,
    title: draft.title,
    company: draft.company ?? UNNAMED_COMPANY,
    companyIndustry: draft.domain ?? '',
    companySize: '',
    companyWebsite: '',
    location: draft.location ?? '',
    remote: draft.reading?.workArrangement ?? 'onsite',
    employmentType: draft.employmentType ?? 'full_time',
    experienceLevel: draft.experienceLevel ?? 'mid',
    postedAt: draft.createdAt,
    source: 'manual',
    description: draft.rawText,
    responsibilities: draft.responsibilities.slice(0, 60),
    requirements: [],
    tags: [],
    isSaved: false,
    isPick: false,
    isTodaysPick: false,
    relevanceRank: 0,
  };
}

interface Target {
  jobId: string;
  job: Job;
}

/** A listing the candidate can reach, or the job an earlier ask already kept. */
async function targetOfJob(tx: Tx, userId: string, jobId: string): Promise<Target | null> {
  const found = await findListing(tx, userId, jobId);
  if (found) return { jobId, job: toClientJob(found.normalized, 0) };
  const kept = await tx.selectFrom('applications').select('job').where('user_id', '=', userId).where('job_id', '=', jobId).executeTakeFirst();
  return kept ? { jobId, job: storedJob(kept) } : null;
}

/** The job behind a job description: its listing when it came from one. */
async function targetOfJd(tx: Tx, userId: string, jdId: string): Promise<Target | null> {
  const row = await tx.selectFrom('job_descriptions').select(COLUMNS).where('id', '=', jdId).executeTakeFirst();
  if (!row) return null;
  const draft = toDraft(row as Row);
  if (row.job_id) {
    const listed = await targetOfJob(tx, userId, row.job_id);
    return listed ?? { jobId: row.job_id, job: jobFromDraft(draft, row.job_id) };
  }
  const id = jobIdOfJd(jdId);
  return { jobId: id, job: jobFromDraft(draft, id) };
}

async function targetOf(tx: Tx, userId: string, target: ApplicationTarget): Promise<{ target: Target; resumeId: string | null } | null> {
  if ('jobId' in target) {
    const found = await targetOfJob(tx, userId, target.jobId);
    return found ? { target: found, resumeId: target.resumeId ?? null } : null;
  }
  const resume = await tx.selectFrom('resumes').select(['job_description_id']).where('id', '=', target.resumeId).executeTakeFirst();
  if (!resume?.job_description_id) return null;
  const found = await targetOfJd(tx, userId, resume.job_description_id);
  return found ? { target: found, resumeId: target.resumeId } : null;
}

/** Keeps the job as it stood, so the row outlives its listing. Asks nothing about a known job. */
async function open(tx: Tx, userId: string, target: Target, resumeId: string | null, askAfter: Date): Promise<void> {
  await tx
    .insertInto('applications')
    .values({ user_id: userId, job_id: target.jobId, resume_id: resumeId, job: JSON.stringify(target.job), ask_after: askAfter })
    .onConflict((oc) => oc.columns(['user_id', 'job_id']).doNothing())
    .execute();
}

/**
 * Asks now, after a download or a visit to the employer's page. A row already answered "not yet"
 * keeps its wait, so a second download on the same day does not ask again.
 */
export async function askAbout(db: Database, identity: Identity, target: ApplicationTarget): Promise<ApplicationAsk | null> {
  return db.withUser(identity, async (tx) => {
    const resolved = await targetOf(tx, identity.userId, target);
    if (!resolved) return null;
    const now = new Date();
    await open(tx, identity.userId, resolved.target, resolved.resumeId, now);
    const row = await tx
      .updateTable('applications')
      .set({ ask_after: now, ...(resolved.resumeId ? { resume_id: resolved.resumeId } : {}) })
      .where('user_id', '=', identity.userId)
      .where('job_id', '=', resolved.target.jobId)
      .where('status', '=', 'asking')
      .where('asks_left', '=', 2)
      .returning(ROW)
      .executeTakeFirst();
    return row ? toAsk(row as ApplicationRow) : null;
  });
}

/** A finished run for a job starts an ask for the next time the app opens. In the run's transaction. */
export async function askAfterRun(tx: Tx, run: { user_id: string; kind: string; job_description_id: string | null; resume_id: string | null }): Promise<void> {
  if (!run.job_description_id || !APPLYING_KINDS.includes(run.kind)) return;
  const target = await targetOfJd(tx, run.user_id, run.job_description_id);
  if (target) await open(tx, run.user_id, target, run.resume_id, new Date(Date.now() + RUN_DELAY_MINUTES * 60_000));
}

export const listAsks = (db: Database, identity: Identity): Promise<ApplicationAsk[]> =>
  db.withUser(identity, async (tx) => {
    const rows = await tx
      .selectFrom('applications')
      .select(ROW)
      .where('user_id', '=', identity.userId)
      .where('status', '=', 'asking')
      .where('asks_left', '>', 0)
      .where('ask_after', '<=', new Date())
      .orderBy('ask_after', 'asc')
      .limit(MAX_ASKS_LISTED)
      .execute();
    return rows.map((row) => toAsk(row as ApplicationRow));
  });

export async function answerAsk(db: Database, identity: Identity, id: string, answer: ApplicationAnswer): Promise<void> {
  await db.withUser(identity, async (tx) => {
    const row = await tx.selectFrom('applications').select(['id', 'status', 'asks_left']).where('id', '=', id).executeTakeFirst();
    if (!row) throw errors.notFound('application');
    // A repeat of the same answer, from a second device or a retry, changes nothing.
    if (row.status !== 'asking') return;
    const update = tx.updateTable('applications').where('id', '=', id);
    if (answer === 'yes') await update.set({ status: 'applied', applied_at: sql`now()`, ask_after: null, asks_left: 0 }).execute();
    else if (answer === 'no') await update.set({ status: 'declined', ask_after: null, asks_left: 0 }).execute();
    else {
      const left = Math.max(0, row.asks_left - 1);
      await update.set({ asks_left: left, ask_after: left > 0 ? sql`now() + make_interval(days => ${ASK_AGAIN_DAYS})` : null }).execute();
    }
  });
}

/** The Applied list, newest first. Rows still asking, or answered "no", are not applications. */
export const listApplications = (db: Database, identity: Identity): Promise<ApplicationWithJob[]> =>
  db.withUser(identity, async (tx) => {
    const rows = await tx.selectFrom('applications').select(ROW).where('user_id', '=', identity.userId).where('applied_at', 'is not', null).orderBy('applied_at', 'desc').limit(500).execute();
    if (rows.length === 0) return [];
    const saved = await tx
      .selectFrom('saved_jobs')
      .select(sql<string>`app.job_id_of(apply_url_hash)`.as('job_id'))
      .where('user_id', '=', identity.userId)
      .execute();
    const savedIds = new Set(saved.map((s) => s.job_id));
    return rows.map((row) => ({ application: toApplication(row as ApplicationRow), job: { ...storedJob(row), isSaved: savedIds.has(row.job_id) } }));
  });

/** "I applied", said directly. Idempotent: an application keeps its first date and status. */
export async function recordApplied(db: Database, identity: Identity, jobId: string): Promise<Application> {
  return db.withUser(identity, async (tx) => {
    const target = await targetOfJob(tx, identity.userId, jobId);
    if (!target) throw errors.notFound('job');
    await open(tx, identity.userId, target, null, new Date());
    await tx
      .updateTable('applications')
      .set({ status: 'applied', applied_at: sql`now()`, ask_after: null, asks_left: 0 })
      .where('user_id', '=', identity.userId)
      .where('job_id', '=', jobId)
      .where('applied_at', 'is', null)
      .execute();
    const row = await tx.selectFrom('applications').select(ROW).where('user_id', '=', identity.userId).where('job_id', '=', jobId).executeTakeFirstOrThrow();
    return toApplication(row as ApplicationRow);
  });
}

export async function setStatus(db: Database, identity: Identity, id: string, status: ApplicationStatus): Promise<Application> {
  return db.withUser(identity, async (tx) => {
    const row = await tx.updateTable('applications').set({ status }).where('id', '=', id).where('applied_at', 'is not', null).returning(ROW).executeTakeFirst();
    if (!row) throw errors.notFound('application');
    return toApplication(row as ApplicationRow);
  });
}

