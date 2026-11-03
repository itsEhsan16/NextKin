import type { PartialDate } from '@nextkin/engines/dates';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { resolveSkill } from '@nextkin/engines/normalizer';
import type { Tailoring } from '@nextkin/shared/schemas/generation';
import { factsOfDocument, placesOf, withChoices, withFigures } from '@nextkin/shared/scoring/documentFacts';
import { TAILOR_PATH } from '@nextkin/shared/scoring/fixPlan';
import { jobMatchOf, keywordsFrom, scoringJdOf } from '@nextkin/shared/scoring/tailorComparison';

import { redactContact } from '../ai/pii';
import type { Tx } from '../db/database';
import { errors } from '../http/errors';
import type { FactsSnapshot } from '../pipeline/facts';
import { scoreAgainst } from '../pipeline/stages/persist';
import type { TailorRunInput } from '../pipeline/stages/tailorMerge';
import { findRow, toDraft } from './jdDraft';
import { measureBase, readBase } from './tailorBase';

/** Skills the user says are true go on the profile first (BUILD 04c; W-TAILOR 02's ticks). */
export async function addProfileSkills(tx: Tx, userId: string, names: readonly string[]): Promise<void> {
  for (const skill of names) {
    await tx
      .insertInto('profile_skills')
      .values({ user_id: userId, raw_name: skill.slice(0, 120), provenance: 'user' })
      .onConflict((oc) => oc.columns(['user_id', 'raw_name']).doNothing())
      .execute();
  }
}

/**
 * A tailored run's start (toreview §110.3). The owner's rule: compare the job with the resume the
 * user picked, ask about each missing keyword, then build from that resume plus what they ticked.
 * - The JD must be read (409) and the resume the user's own (404).
 * - The run's facts are that resume's own lines (`factsOfDocument`), contact-redacted, with the
 *   ticked keywords as listed skills; the ticks also go on the profile, as a build's do.
 * - The base version, the baseline score (measured exactly as W-TAILOR 01 measured it) and the
 *   keywords left out are pinned on the run, so a retry tailors the same lines to the same rules.
 */
export async function prepareTailor(
  tx: Tx,
  userId: string,
  args: { kind: string; jdId: string | undefined; baseResumeId: string | undefined; tailoring: Tailoring; asOf: PartialDate },
): Promise<{ snapshot: FactsSnapshot; tailor: TailorRunInput }> {
  if (args.kind !== 'resume' || !args.jdId || !args.baseResumeId) {
    throw errors.validation({ fields: ['kind', 'jdId', 'baseResumeId'] }, 'A tailored resume needs a job description and a resume to start from.');
  }
  const draft = toDraft(await findRow(tx, args.jdId));
  if (draft.status !== 'ready') throw errors.conflict('This job description is still being read, or could not be read. Check its details first.');
  const base = await readBase(tx, userId, args.baseResumeId);

  const key = (name: string) => resolveSkill(TAXONOMY, name).id;
  // A confirmation names a place of this resume (toreview §112); one naming another is ignored. A
  // place the user chose is a citable line; the AI's pick (`by: 'ai'`) only lets that role name the
  // keyword, on a line about that work (owner, toreview §162, after §159 dropped it entirely).
  const places = new Set(placesOf(base.doc).map((p) => p.id));
  // A keyword may be at several places (§163); each (keyword, place) counts once.
  const seen = new Set<string>();
  const firstTime = (c: { keyword: string; where: string }) => {
    const id = `${key(c.keyword)} ${c.where}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  };
  const confirmed = (args.tailoring.confirmed ?? []).filter((c) => places.has(c.where) && firstTime(c)).map((c) => ({ keyword: c.keyword.trim(), where: c.where, ...(c.note?.trim() ? { note: c.note.trim() } : {}), ...(c.by ? { by: c.by } : {}) }));
  const ticked = [...new Map([...args.tailoring.keywords, ...confirmed.map((c) => c.keyword)].map((k) => [key(k), k.trim()])).values()];
  const tickedKeys = new Set(ticked.map(key));
  const baseline = measureBase(base, draft, args.asOf);
  const skipped = keywordsFrom(baseline)
    .filter((k) => !k.onResume && !tickedKeys.has(key(k.label)))
    .map((k) => k.label);

  const baselineJobMatch = jobMatchOf(keywordsFrom(baseline, draft.rawText, draft.title));
  // A rewritten bullet replaces a line of this resume that exists (toreview §129); others are ignored.
  const figures = (args.tailoring.figures ?? []).filter((f) => base.doc.roles.some((r) => r.roleId === f.where && f.line < r.bullets.length));
  const source = withFigures(base.doc, figures);
  // Ticked keywords with no place go in the skills list only (owner, toreview §159); a bullet names
  // one only where its own lines support it.
  const facts = factsOfDocument(source, { added: ticked, confirmed, redact: redactContact });
  const projected = projectionOf({ source, facts, contact: base.contact, draft, ticked, confirmed, fixes: args.tailoring.fixes, asOf: args.asOf });
  await addProfileSkills(tx, userId, ticked);
  return {
    // Ticked keywords no place was given for are listed in the skills (toreview §159).
    snapshot: { facts, contact: base.contact },
    tailor: {
      baseResumeId: base.card.id,
      baseVersionId: base.versionId,
      // As asked: a part switched off is left as it is, even when every part is (ticks still apply).
      fixes: [...new Set(args.tailoring.fixes)],
      experience: args.tailoring.experience ?? 'full',
      added: ticked,
      ...(confirmed.length ? { confirmed } : {}),
      ...(figures.length ? { figures } : {}),
      ...(projected !== undefined ? { projected } : {}),
      skipped,
      baselineScore: baseline.score?.total ?? 0,
      ...(baselineJobMatch ? { baselineJobMatch } : {}),
      sourcePages: base.pages,
      sourceMeasured: base.pagesMeasured,
    },
  };
}

/**
 * What the plan promises for these choices (toreview §129): the resume with the user's answers in
 * place — rewritten bullets, ticked keywords listed, confirmed ones on their role — then the AI's
 * own steps (the template's layout; the summary, when that part is on), re-scored. A keyword the
 * AI places in a line earns more than this counts, so the run should meet or beat it; the ready
 * screen says so when it doesn't.
 */
function projectionOf(args: {
  source: Parameters<typeof withChoices>[0];
  facts: ReturnType<typeof factsOfDocument>;
  contact: Parameters<typeof scoreAgainst>[0]['contact'];
  draft: Parameters<typeof scoringJdOf>[0];
  ticked: readonly string[];
  confirmed: readonly { keyword: string; where: string }[];
  fixes: Tailoring['fixes'];
  asOf: PartialDate;
}): number | undefined {
  const document = withChoices(args.source, { added: args.ticked, confirmed: args.confirmed });
  const path = { ...TAILOR_PATH, aiCan: { ...TAILOR_PATH.aiCan, sections: args.fixes.includes('summary') ? (['summary'] as const) : [] } };
  const result = scoreAgainst({ document, facts: args.facts, contact: args.contact, jd: scoringJdOf(args.draft), asOf: args.asOf, path });
  return result.path ? Math.round(result.path.aiBps / 100) : undefined;
}
