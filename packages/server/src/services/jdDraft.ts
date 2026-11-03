import { UNTITLED_JD, type JdDraft, type JdDraftPatch, type JdStage } from '@nextkin/shared/models/jd';
import { jdStructuredSchema } from '@nextkin/shared/schemas/jdStructured';
import { jdLists, typedRequirements } from '@nextkin/shared/scoring/adapters';

import type { Tx } from '../db/database';
import { errors } from '../http/errors';
import type { VerifiedJd } from '../pipeline/stages/extractJd';

/** A `job_descriptions` row, and the draft the review screen and generation read from it (§7.5). */
export type Row = {
  id: string;
  source: string;
  raw_text: string;
  extracted: unknown;
  edited: unknown;
  status: string;
  error_message: string | null;
  stats: unknown;
  language: string | null;
  job_id: string | null;
  source_url: string | null;
  stage: string | null;
  structure_version: number | null;
  created_at: Date;
};

export const COLUMNS = ['id', 'source', 'raw_text', 'extracted', 'edited', 'status', 'error_message', 'stats', 'language', 'job_id', 'source_url', 'stage', 'structure_version', 'created_at'] as const;

const present = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined && value !== '';

/** The extraction with the user's corrections on top: the draft the review screen and generation read. */
export function toDraft(row: Row): JdDraft {
  const x = (row.extracted ?? {}) as Partial<VerifiedJd>;
  const e = (row.edited ?? {}) as JdDraftPatch;
  const pick = <K extends keyof JdDraftPatch>(key: K, fallback: JdDraftPatch[K] | null | undefined) => (e[key] !== undefined ? e[key] : (fallback ?? undefined));
  const lists = {
    requiredSkills: pick('requiredSkills', x.requiredSkills) ?? [],
    preferredSkills: pick('preferredSkills', x.preferredSkills) ?? [],
    tools: pick('tools', x.tools) ?? [],
    responsibilities: pick('responsibilities', x.responsibilities) ?? [],
  };
  const company = pick('company', x.company);
  const location = pick('location', x.location);
  const level = pick('experienceLevel', x.experienceLevel);
  const employment = pick('employmentType', x.employmentType);
  const domain = pick('domain', x.domain);
  const stats = row.stats as { kept?: number; dropped?: number } | null;
  // The structured reading is checked again on the way out: a row that no longer validates is shown
  // the old way rather than half-drawn (toreview §153).
  const structured = x.structured ? jdStructuredSchema.safeParse(x.structured) : undefined;
  return {
    id: row.id,
    source: row.source as JdDraft['source'],
    title: pick('title', x.title) ?? UNTITLED_JD,
    ...(present(company) ? { company } : {}),
    ...(present(location) ? { location } : {}),
    ...(present(level) ? { experienceLevel: level } : {}),
    ...(present(employment) ? { employmentType: employment } : {}),
    ...(present(domain) ? { domain } : {}),
    ...lists,
    ...(x.softSkills?.length ? { softSkills: x.softSkills } : {}),
    rawText: row.raw_text,
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(e.savedToJobs !== undefined ? { savedToJobs: e.savedToJobs } : {}),
    ...(row.job_id ? { jobId: row.job_id } : {}),
    requirements: row.status === 'ready' ? typedRequirements(jdLists({ ...lists, rawText: row.raw_text })) : [],
    status: row.status as JdDraft['status'],
    ...(row.error_message ? { error: row.error_message } : {}),
    ...(stats && typeof stats.kept === 'number' ? { extraction: { kept: stats.kept, dropped: stats.dropped ?? 0 } } : {}),
    ...(row.language ? { language: row.language as 'en' | 'de' } : x.language === 'other' ? { language: 'other' as const } : {}),
    ...(x.reading ? { reading: x.reading } : {}),
    ...(structured?.success ? { structured: x.structured } : {}),
    ...(row.status === 'extracting' && row.stage ? { stage: row.stage as JdStage } : {}),
    createdAt: row.created_at.toISOString(),
  };
}

export async function findRow(tx: Tx, id: string): Promise<Row> {
  const row = await tx.selectFrom('job_descriptions').select(COLUMNS).where('id', '=', id).executeTakeFirst();
  if (!row) throw errors.notFound('job description');
  return row as Row;
}
