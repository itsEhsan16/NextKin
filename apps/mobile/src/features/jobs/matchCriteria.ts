import type { MatchBand, MatchCriterion, MatchCriterionState } from '@/data/models';
import type { ColorToken } from '@/theme';
import type { LineIconName } from '@/ui/Icon';

/**
 * The rules and the copy behind the full match breakdown (V2 §7.13).
 *
 * Pure, and kept out of the screen: "what the percentage means" and "which criteria the reader
 * can act on" are facts about a match rather than about the page that draws it, and the honesty
 * note has to read the same wherever it is said. The same split `coverLetterSetup.ts` makes for
 * the cover-letter intake.
 */

/**
 * V2 §7.13, verbatim and not optional. The number is computed from the profile we hold, by us —
 * it is not a shortlisting prediction and no employer has seen it. Softening any of those three
 * clauses turns an indicative score into a promise, so the line is a constant a test can pin
 * rather than copy sitting loose in JSX.
 */
export const MATCH_HONESTY_NOTE =
  'This is an indicative match against your own profile — not a prediction that you will be ' +
  'shortlisted, and not a judgement by the employer.';

/** Caption inside the ring. */
export const MATCH_RING_LABEL = 'MATCH';

/** The sticky primary's label, shared with the inert copy the loading state pins. */
export const TAILOR_TO_JOB_CTA = 'Tailor resume to this job';

/**
 * `Job.matchScore` is a fraction (0.91) and `ScoreRing` takes a 0–100 number, so the conversion
 * happens once, here, instead of at every call site that wants to show it. Out-of-range and
 * non-finite scores clamp rather than drawing an arc past the circle.
 */
export function matchPercentage(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}

/**
 * The ring's arc colour per band, paired with `MatchPill`'s own success / warning / neutral
 * tones so the ring and the pill beside it never disagree about how good the match is. Strong is
 * the deeper #16A34A JOBS 10 draws its arc in (580:2439).
 */
export const MATCH_RING_COLOR: Record<MatchBand, ColorToken> = {
  strong: 'glyphSuccess',
  good: 'warningAccent',
  fair: 'iconDefault',
  // `weak` (C-10) has no board yet, so it shares fair's arc.
  weak: 'iconDefault',
};

/**
 * Each state gets its own glyph and colour, so the row is legible without relying on colour.
 * Deliberately identical to the map `JobMatchCard` draws its three rows with: the breakdown is
 * the same content at full length, and two vocabularies for one set of states would be worse
 * than the duplication.
 */
export const CRITERION_ICON: Record<
  MatchCriterionState,
  { name: LineIconName; color: ColorToken }
> = {
  met: { name: 'CheckCircle', color: 'glyphSuccess' },
  // D-14's half credit: drawn as met until a design gives it its own glyph (toreview §105.18).
  partial: { name: 'CheckCircle', color: 'glyphSuccess' },
  missing: { name: 'XCircle', color: 'glyphDanger' },
  optional: { name: 'Circle', color: 'iconChevron' },
};

/** Each group card's progress fill (JOBS 10 580:2462 / 580:2475 / 580:2496), in its glyph's colour. */
export const CRITERIA_BAR_COLOR: Record<MatchCriterionState, ColorToken> = {
  met: 'glyphSuccess',
  partial: 'glyphSuccess',
  missing: 'glyphDanger',
  optional: 'iconChevron',
};

/** Read out instead of the glyph, which a screen reader would otherwise skip entirely. */
export const CRITERION_A11Y: Record<MatchCriterionState, string> = {
  met: 'Met',
  partial: 'Partly met',
  missing: 'Missing',
  optional: 'Optional',
};

/**
 * One accessibility element per row: the state, then the criterion, then the evidence — so the
 * reader hears "Missing. Fintech / payments experience. Required: 3 years" rather than an
 * unlabelled icon followed by two unrelated strings.
 */
export function criterionA11yLabel(criterion: MatchCriterion): string {
  const head = `${CRITERION_A11Y[criterion.state]}. ${criterion.label}`;
  return criterion.detail ? `${head}. ${criterion.detail}` : head;
}

/** Each group card's title (JOBS 10 580:2458). */
export const CRITERIA_GROUP_TITLE: Record<MatchCriterionState, string> = {
  missing: 'Missing',
  met: 'Met',
  partial: 'Met',
  optional: 'Optional',
};

/**
 * Missing leads, and that is the whole point of the ordering: it is the only group the reader
 * can do anything about, so it must not sit under a list of things that are already fine. Met
 * follows as the evidence for the number, and optional last because nothing there is required.
 */
export const CRITERIA_GROUP_ORDER: readonly MatchCriterionState[] = ['missing', 'met', 'optional'];

export type CriteriaGroup = {
  state: MatchCriterionState;
  title: string;
  items: MatchCriterion[];
};

/**
 * Groups the criteria for display, in `CRITERIA_GROUP_ORDER`, keeping the job's own order inside
 * each group. A group with no rows is dropped rather than rendered as an empty heading — an
 * "Optional" card over nothing reads as content that failed to load.
 */
export function groupMatchCriteria(criteria: readonly MatchCriterion[]): CriteriaGroup[] {
  return CRITERIA_GROUP_ORDER.map((state) => ({
    state,
    title: CRITERIA_GROUP_TITLE[state],
    // A partly met criterion sits in Met, its detail saying why (no design draws it apart yet).
    items: criteria.filter(
      (criterion) =>
        criterion.state === state || (state === 'met' && criterion.state === 'partial'),
    ),
  })).filter((group) => group.items.length > 0);
}
