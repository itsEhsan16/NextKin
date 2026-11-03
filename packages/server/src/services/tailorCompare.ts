import type { TailorComparison } from '@nextkin/shared/models/tailor';
import { TAILOR_PATH } from '@nextkin/shared/scoring/fixPlan';
import { documentText, placesOf } from '@nextkin/shared/scoring/documentFacts';
import { experienceMonths } from '@nextkin/shared/scoring/pageBudget';
import { fitPlacesOf } from '@nextkin/shared/scoring/placeFit';
import { comparisonOf, improvementsFor, keywordsFrom } from '@nextkin/shared/scoring/tailorComparison';
import { yearsAskedOf } from '@nextkin/shared/scoring/yearsAsked';

import type { Database, Identity } from '../db/database';
import { errors } from '../http/errors';
import { findRow, toDraft } from './jdDraft';
import { asOfNow, measureBase, readBase } from './tailorBase';

/**
 * W-TAILOR 01, "See your difference" (toreview §110): one of the user's resumes measured against a
 * job description. The engines score the resume's own text against the JD, with the resume's own
 * lines as the yardstick — exactly how a tailored run measures its baseline and its result
 * (`measureBase`, `scoreAgainst`), so "Up from N" compares like with like (G16). No model call, no
 * quota, no AI consent: it reads only what the user owns. An uploaded file, still as uploaded,
 * brings its own page count and measured layout (toreview §110.6); otherwise the page count is the
 * line-budget estimate (`scoring/pages.ts`), labelled as one, and the layout is NextKin's template.
 */
export async function compareResumeToJd(db: Database, identity: Identity, jdId: string, resumeId: string): Promise<TailorComparison> {
  return db.withUser(identity, async (tx) => {
    const draft = toDraft(await findRow(tx, jdId));
    if (draft.status !== 'ready') throw errors.conflict('This job description is still being read, or could not be read. Check its details first.');
    const base = await readBase(tx, identity.userId, resumeId);
    const { card, doc, pages, pagesMeasured, layout } = base;
    const asOf = asOfNow();
    // With the path to 8.5 (toreview §129): each step re-scored on top of the ones before it.
    const result = measureBase(base, draft, asOf, TAILOR_PATH);
    const topKeywords = keywordsFrom(result, draft.rawText, draft.title).filter((k) => k.top).map((k) => k.label);
    return comparisonOf({
      resumeId,
      jdId: draft.id,
      ...(draft.jobId ? { jobId: draft.jobId } : {}),
      result,
      improvements: improvementsFor({
        headline: doc.headline ?? card.targetRole ?? card.title,
        summary: doc.summary?.text ?? '',
        ...(card.targetRole ? { writtenFor: card.targetRole } : {}),
        pages,
        pagesEstimated: !pagesMeasured,
        layout: layout ? { from: 'file', ok: layout.found.length === 0, found: layout.found } : { from: 'template' },
        target: { title: draft.title, ...(draft.company ? { company: draft.company } : {}) },
        years: { asked: yearsAskedOf(draft.rawText, draft.experienceLevel), shownMonths: experienceMonths(doc, { year: asOf.year, month: asOf.month ?? 12 }) },
        topKeywords,
      }),
      pageCount: pages,
      pagesEstimated: !pagesMeasured,
      rawText: draft.rawText,
      title: draft.title,
      ...(draft.softSkills?.length ? { softSkills: draft.softSkills } : {}),
      resumeText: documentText(doc),
      places: placesOf(doc),
      fitPlaces: fitPlacesOf(doc),
      asOf,
    });
  });
}
