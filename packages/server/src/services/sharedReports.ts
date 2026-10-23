import { createHash, randomBytes } from 'node:crypto';

import { atsBandFor, type AtsReport } from '@nextkin/shared/models/resume';
import type { SharedReport } from '@nextkin/shared/schemas/sharedReport';
import { sql } from 'kysely';

import type { Database, Identity } from '../db/database';
import { errors } from '../http/errors';

/**
 * The shareable ATS report (ImBackendImplementationPlan P11-10; V2 §4.1). Sharing freezes a
 * redacted snapshot of the document's latest report behind a random token; only the token's hash
 * is stored, so the link is shown once and a database read cannot rebuild it. Revoking takes effect
 * on the next read. The public read is the system role, by token hash, and returns the snapshot only.
 *
 * Redaction is by construction, not by filtering a whole report: the snapshot is built field by
 * field from the report's numbers, its rubric captions, the JD's requirement names and a few
 * suggestion labels of the kinds that cannot name the user's employers or quote their text.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
/** Suggestions whose labels name only the JD's skills or a section: never a role, an employer or the user's wording. */
const SHAREABLE_FIXES = new Set(['surface_backed_skill', 'gap', 'complete_section', 'formatting']);
const MAX_SUGGESTIONS = 3;

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

export function redactReport(report: AtsReport, hasJd: boolean, target: { title: string | null; company: string | null }, sharedAt: Date): SharedReport {
  const total = hasJd ? report.total : null;
  return {
    targetTitle: target.title,
    targetCompany: target.company,
    total,
    band: total === null ? null : atsBandFor(total),
    jdMatch: hasJd && report.jdMatch ? { percent: report.jdMatch.percent, requiredMet: report.jdMatch.requiredMet, requiredPartial: report.jdMatch.requiredPartial, requiredTotal: report.jdMatch.requiredTotal, preferredMet: report.jdMatch.preferredMet, preferredTotal: report.jdMatch.preferredTotal } : null,
    components: report.components.map((c) => ({ key: c.key, label: c.label, weight: c.weight, score: c.score, points: c.points, basis: c.basis })),
    requirements: hasJd ? report.requirements.map((r) => ({ text: r.text, importance: r.importance, status: r.status })) : [],
    suggestions: [...report.fixes]
      .filter((f) => SHAREABLE_FIXES.has(f.type))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, MAX_SUGGESTIONS)
      .map((f) => f.label),
    method: { engine: report.provenance.engine, rubric: report.provenance.rubric, taxonomy: report.provenance.taxonomy, kb: report.provenance.kb, asOf: report.provenance.asOf },
    sharedAt: sharedAt.toISOString(),
  };
}

export async function createShare(db: Database, identity: Identity, resumeId: string, options: { showEmployer: boolean; origin: string }): Promise<{ id: string; url: string }> {
  if (!UUID.test(resumeId)) throw errors.notFound('resume');
  const token = randomBytes(24).toString('base64url');
  const id = await db.withUser(identity, async (tx) => {
    const resume = await tx.selectFrom('resumes').select(['id', 'current_version_id', 'job_description_id']).where('id', '=', resumeId).where('trashed_at', 'is', null).executeTakeFirst();
    if (!resume) throw errors.notFound('resume');
    const report = resume.current_version_id
      ? await tx.selectFrom('ats_reports').select(['id', 'basis', 'has_jd']).where('resume_version_id', '=', resume.current_version_id).orderBy('created_at', 'desc').executeTakeFirst()
      : undefined;
    const full = (report?.basis as { report?: AtsReport } | null)?.report;
    if (!report || !full) throw errors.conflict('This document has no ATS report to share yet. Score it first.');
    const jd = resume.job_description_id ? await tx.selectFrom('job_descriptions').select(['extracted', 'edited']).where('id', '=', resume.job_description_id).executeTakeFirst() : undefined;
    const field = (key: 'title' | 'company') => ((jd?.edited as Record<string, string | null> | null)?.[key] ?? (jd?.extracted as Record<string, string | null> | null)?.[key]) || null;
    const snapshot = redactReport(full, report.has_jd, { title: field('title'), company: options.showEmployer ? field('company') : null }, new Date());
    const row = await tx
      .insertInto('shared_reports')
      .values({ user_id: identity.userId, resume_id: resume.id, ats_report_id: report.id, token_hash: hashOf(token), snapshot: JSON.stringify(snapshot), show_employer: options.showEmployer })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  });
  return { id, url: `${options.origin.replace(/\/$/, '')}/r/${token}` };
}

export async function listShares(db: Database, identity: Identity) {
  const rows = await db.withUser(identity, (tx) => tx.selectFrom('shared_reports').select(['id', 'resume_id', 'snapshot', 'created_at', 'revoked_at']).orderBy('created_at', 'desc').limit(100).execute());
  return rows.map((r) => {
    const s = r.snapshot as SharedReport;
    return { id: r.id, resumeId: r.resume_id, title: s.targetTitle ?? 'ATS report', createdAt: new Date(r.created_at).toISOString(), revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null };
  });
}

/** Stops a link at once. Revoking twice is fine. */
export async function revokeShare(db: Database, identity: Identity, id: string): Promise<void> {
  if (!UUID.test(id)) throw errors.notFound('shared report');
  const row = await db.withUser(identity, (tx) => tx.updateTable('shared_reports').set({ revoked_at: sql`coalesce(revoked_at, now())` }).where('id', '=', id).returning('id').executeTakeFirst());
  if (!row) throw errors.notFound('shared report');
}

/** The public read: a live link's snapshot, or not found (a revoked link and a wrong one look alike). */
export async function readShared(db: Database, token: string): Promise<SharedReport> {
  if (!TOKEN.test(token)) throw errors.notFound('report');
  const row = await db.withSystem('shared report: public read by token hash', (tx) =>
    tx.selectFrom('shared_reports').select('snapshot').where('token_hash', '=', hashOf(token)).where('revoked_at', 'is', null).executeTakeFirst(),
  );
  if (!row) throw errors.notFound('report');
  return row.snapshot as SharedReport;
}
