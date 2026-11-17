/**
 * The sizes a tailored resume can reach, in one place (toreview §212.5).
 *
 * These used to be numbers written where they were checked: a stored resume held 60 skills while
 * a run could accept 80; the "Add the result" answer had 300 tokens while its prompt asked for
 * three rewrites; a result line could be 300 characters in the start request while the AI's own
 * suggestion ran to 440 and a stored bullet to 600. Each was right alone and wrong beside the
 * others, and each surfaced on the demo as a run that would not start or would not finish.
 *
 * So the limits that must agree are derived from one another here, and
 * `packages/shared/test/limits.test.ts` holds them together: whatever one step can produce, the
 * next step must accept. Change a number here, never at the place that checks it.
 */

/** The most keywords one reading of a job description lists (`extractJd`). */
export const JD_SKILLS_MAX = 100;

/** How many skills a resume lists of its own, before any a tailored run adds. */
export const OWN_SKILLS = 60;

/**
 * The most keywords a run may be asked to add. "Accept all" takes every missing keyword of the
 * job, so this is never less than a job can list.
 */
export const ACCEPTED_MAX = JD_SKILLS_MAX;

/**
 * The most skills a stored resume holds: its own, and every keyword the candidate accepted, which
 * are never cut (D-25).
 */
export const MAX_SKILLS = OWN_SKILLS + ACCEPTED_MAX;

/** A keyword may be placed in up to three roles or projects (toreview §163). */
export const PLACES_PER_KEYWORD = 3;
export const CONFIRMED_MAX = ACCEPTED_MAX * PLACES_PER_KEYWORD;

/** The longest line a stored resume holds: a bullet, a summary. */
export const CLAIM_TEXT_MAX = 600;

/** A figure and its unit, as the AI offers it: "about 20%", "1,000+ sellers". */
export const FIGURE_AMOUNT_MAX = 24;
/** An amount the candidate types themselves. */
export const FIGURE_TYPED_MAX = 40;

/**
 * The longest a bullet rewritten around its result may be before the figure goes in: the line's
 * two parts and the figure, with a space either side, still fit a stored line.
 */
export const FIGURE_DRAFT_MAX = CLAIM_TEXT_MAX - FIGURE_TYPED_MAX - 2;

/** A bullet with its result, as the start request carries it: any line a resume can hold. */
export const FIGURE_TEXT_MAX = CLAIM_TEXT_MAX;

/** The most roles a resume holds, and bullets a role holds. */
export const ROLES_MAX = 20;
export const ROLE_BULLETS_MAX = 12;
/** Bullet indexes a result may name. */
export const BULLET_INDEX_MAX = 60;
/** How many bullets one run may carry a result for: "Accept all" fills every line that lacks one. */
export const FIGURES_MAX = 120;
