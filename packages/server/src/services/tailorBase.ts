import type { PartialDate } from '@nextkin/engines/dates';
import type { FormatFacts } from '@nextkin/engines/document';
import type { TargetPathOptions } from '@nextkin/engines/targetPlan';
import type { JdDraft } from '@nextkin/shared/models/jd';
import type { Resume } from '@nextkin/shared/models/resume';
import type { ContactPresence } from '@nextkin/shared/scoring/adapters';
import { factsOfDocument } from '@nextkin/shared/scoring/documentFacts';
import type { DocumentScore } from '@nextkin/shared/scoring/report';
import { scoringJdOf } from '@nextkin/shared/scoring/tailorComparison';
import { canonicalResumeSchema, type CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';
import { parseFindingsSchema } from '@nextkin/shared/schemas/uploads';
import type { z } from 'zod';

import type { Tx } from '../db/database';
import { errors } from '../http/errors';
import { scoreAgainst } from '../pipeline/stages/persist';
import { tailoredPages } from '../pipeline/stages/tailorMerge';
import { resumeCard } from './resumeRead';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Now" as a run fixes it at start (UTC month): the comparison uses the same, so they agree. */
export const asOfNow = (now = new Date()): PartialDate => ({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });

/**
 * The resume a tailored run starts from (toreview §110.3): one of the user's own, its current
 * version in canonical form. Its lines are the run's facts (`factsOfDocument`), and both the
 * comparison (W-TAILOR 01) and the run measure it with `measureBase`, so the baseline is one number.
 */
export interface TailorBase {
  card: Resume;
  versionId: string;
  doc: CanonicalResumeJson;
  /** Presence only, as a run's facts snapshot holds it (`pipeline/facts.ts`). */
  contact: ContactPresence;
  /** How many pages it runs to: the uploaded file's own count, else the line-budget estimate. */
  pages: number;
  pagesMeasured: boolean;
  /** The uploaded file's layout, measured from it (toreview §110.6); absent for a NextKin document. */
  layout?: FileLayout;
}

type FileLayout = NonNullable<z.infer<typeof parseFindingsSchema>['layout']>;

export async function readBase(tx: Tx, userId: string, resumeId: string): Promise<TailorBase> {
  if (!UUID.test(resumeId)) throw errors.notFound('resume');
  const card = await resumeCard(tx, resumeId); // RLS: another user's resume is not found
  if (card.docType !== 'resume') throw errors.notFound('resume');
  const version = card.currentVersionId
    ? await tx.selectFrom('resume_versions').select(['id', 'content', 'created_by']).where('id', '=', card.currentVersionId).executeTakeFirst()
    : undefined;
  const doc = canonicalResumeSchema.safeParse(version?.content);
  if (!version || !doc.success) throw errors.notFound('content');
  const profile = await tx.selectFrom('profiles').select(['phone', 'location']).where('user_id', '=', userId).executeTakeFirst();
  // The file's own measurements describe the resume only while it is still the file as uploaded;
  // once edited here, it downloads in NextKin's template.
  const parse = version.created_by === 'upload'
    ? await tx.selectFrom('resume_parses').select('findings').where('resume_id', '=', resumeId).orderBy('created_at', 'desc').executeTakeFirst()
    : undefined;
  const file = parse ? parseFindingsSchema.safeParse(parse.findings) : undefined;
  const measured = file?.success ? file.data : undefined;
  return {
    card,
    versionId: version.id,
    doc: doc.data,
    contact: { email: true, phone: Boolean(profile?.phone), location: Boolean(profile?.location) },
    pages: measured?.pages ?? tailoredPages(doc.data),
    pagesMeasured: measured?.pages != null,
    ...(measured?.layout ? { layout: measured.layout } : {}),
  };
}

/** The base against the JD, its own lines the yardstick: W-TAILOR 01's score and the run's baseline. */
export const measureBase = (base: TailorBase, draft: JdDraft, asOf: PartialDate, path?: TargetPathOptions): DocumentScore =>
  scoreAgainst({ document: base.doc, facts: factsOfDocument(base.doc), contact: base.contact, jd: scoringJdOf(draft), asOf, ...(base.layout ? { format: formatOf(base.layout) } : {}), ...(path ? { path } : {}) });

/** The layout part of the score from what the file showed, not from NextKin's template. */
const formatOf = (layout: FileLayout): FormatFacts => ({ singleColumn: layout.singleColumn, standardHeadings: layout.standardHeadings, noTablesOrImages: layout.noTablesOrImages, standardFonts: layout.standardFonts, contactInBody: layout.contactInBody });
