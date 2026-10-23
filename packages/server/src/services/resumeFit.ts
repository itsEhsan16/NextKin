import { randomUUID } from 'node:crypto';

import { canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';

import type { KvCache } from '../cache/kv';
import type { Database, Identity } from '../db/database';
import type { LatexCompiler } from '../export/latex/compile';
import { errors } from '../http/errors';
import type { Logger } from '../observability/logger';
import { enqueue } from '../outbox/outbox';
import { compiledMeasure, dropOrder, fitToPages } from '../pipeline/stages/pageFit';
import { readJdRow, stageJdOf } from '../pipeline/stages/resume';
import { recentRoleIds } from '../pipeline/stages/tailorMerge';
import { userPaper } from './renders';
import { writeResumeVersion } from './versions';

/**
 * "Fit to one page" on the tailor ready screen (toreview §113, Jobright's button). The worker
 * typesets the current version, tightens the spacing, then drops whole bullets — those naming none
 * of the job's skills first, oldest role first, never below a role's floor — until it is one page,
 * and writes that as a new version. Nothing is reworded. The outcome waits in the cache an hour.
 */

export type FitStatus =
  | { status: 'running' }
  | { status: 'done'; changed: boolean; pages: number; dropped: number }
  | { status: 'failed'; reason: 'unavailable' | 'cannot_fit' | 'changed_meanwhile' };

type Stored = FitStatus & { userId: string; resumeId: string };

const TTL_SECONDS = 3600;
const keyOf = (fitId: string) => `fit:v1:${fitId}`;

export async function requestFit(db: Database, kv: KvCache, identity: Identity, resumeId: string, correlationId: string | null): Promise<{ id: string } & FitStatus> {
  const id = randomUUID();
  await db.withUser(identity, async (tx) => {
    const resume = await tx.selectFrom('resumes').select(['doc_type', 'current_version_id']).where('id', '=', resumeId).where('trashed_at', 'is', null).executeTakeFirst();
    if (!resume || resume.doc_type !== 'resume' || !resume.current_version_id) throw errors.notFound('resume');
    await kv.set(keyOf(id), { status: 'running', userId: identity.userId, resumeId } satisfies Stored, TTL_SECONDS);
    await enqueue(tx, { queue: 'generation-priority', groupId: `${identity.userId}#render`, type: 'resume.fit', payload: { fitId: id, userId: identity.userId, resumeId, versionId: resume.current_version_id }, correlationId });
  });
  return { id, status: 'running' };
}

export async function fitStatus(kv: KvCache, identity: Identity, resumeId: string, fitId: string): Promise<FitStatus> {
  const stored = await kv.get<Stored>(keyOf(fitId));
  if (!stored || stored.userId !== identity.userId || stored.resumeId !== resumeId) throw errors.notFound('fit');
  if (stored.status === 'done') return { status: 'done', changed: stored.changed, pages: stored.pages, dropped: stored.dropped };
  if (stored.status === 'failed') return { status: 'failed', reason: stored.reason };
  return { status: 'running' };
}

export async function runFit(
  deps: { db: Database; kv: KvCache; latex?: LatexCompiler; log: Logger },
  payload: { fitId: string; userId: string; resumeId: string; versionId: string },
): Promise<FitStatus['status']> {
  const done = async (status: FitStatus) => {
    await deps.kv.set(keyOf(payload.fitId), { ...status, userId: payload.userId, resumeId: payload.resumeId } satisfies Stored, TTL_SECONDS);
    deps.log.info({ event: 'resume.fit', status: status.status, ...(status.status === 'done' ? { changed: status.changed, dropped: status.dropped } : {}) }, 'fit to one page');
    return status.status;
  };
  if (!deps.latex) return done({ status: 'failed', reason: 'unavailable' });
  const identity: Identity = { userId: payload.userId, role: 'user' };
  const job = await deps.db.withUser(identity, async (tx) => {
    const resume = await tx.selectFrom('resumes').select(['current_version_id', 'job_description_id']).where('id', '=', payload.resumeId).executeTakeFirst();
    if (!resume || resume.current_version_id !== payload.versionId) return null;
    const version = await tx.selectFrom('resume_versions').select('content').where('id', '=', payload.versionId).executeTakeFirstOrThrow();
    const jdRow = resume.job_description_id ? await readJdRow(tx, resume.job_description_id) : undefined;
    const jd = jdRow && jdRow.status === 'ready' ? stageJdOf(jdRow) : null;
    return { doc: canonicalResumeSchema.parse(version.content), jd, jdId: resume.job_description_id, paper: await userPaper(tx, payload.userId) };
  });
  if (!job) return done({ status: 'failed', reason: 'changed_meanwhile' });

  const { doc, jd } = job;
  let fit;
  try {
    fit = await fitToPages({
      doc,
      budget: 1,
      mayTrim: true,
      order: dropOrder(doc, recentRoleIds(doc), jd ? [...jd.requiredSkills, ...jd.preferredSkills, ...jd.tools] : []),
      measure: compiledMeasure(deps.latex, jd?.location ?? null, job.paper),
      compiled: true,
    });
  } catch {
    return done({ status: 'failed', reason: 'unavailable' });
  }
  if (fit.pages > 1) return done({ status: 'failed', reason: 'cannot_fit' });
  if (fit.dropped === 0 && fit.density === 0) return done({ status: 'done', changed: false, pages: fit.pages, dropped: 0 });
  await deps.db.withUser(identity, (tx) =>
    writeResumeVersion(tx, {
      userId: payload.userId,
      resumeId: payload.resumeId,
      jdId: job.jdId,
      doc: fit.doc,
      note: fit.dropped > 0 ? `Fitted to one page: ${fit.dropped} ${fit.dropped === 1 ? 'bullet' : 'bullets'} left out` : 'Fitted to one page: tighter spacing',
      createdBy: 'user',
      density: fit.density,
      inheritAccuracy: true,
    }),
  );
  return done({ status: 'done', changed: true, pages: fit.pages, dropped: fit.dropped });
}
