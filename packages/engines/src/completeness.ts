import { divRoundHalfEven, FULL_BPS, type Bps } from './bps';

/**
 * Profile completeness (spec §7.3; ImBackendImplementationPlan P5-04, old plan M1-07).
 *
 * "A percentage computed from weighted fields (experience entries with dates and skill tags weigh
 * heaviest), with an explicit list of missing items." It is derived from the data and nothing
 * else: the same profile always gives the same number, and no call can move it without a data
 * change. Tapping a next step does not count; adding what the step asks for does.
 *
 * The experience items carry 45% between them, the most of any section. Weights are integers in
 * basis points and sum to exactly 100%.
 */

export type CompletenessKey =
  | 'experience'
  | 'role_skills'
  | 'education'
  | 'skills'
  | 'headline'
  | 'location'
  | 'phone'
  | 'links'
  | 'certifications';

/** Weight of each item, in basis points. Ordered heaviest first; ties keep this order. */
export const COMPLETENESS_WEIGHTS: Readonly<Record<CompletenessKey, Bps>> = {
  role_skills: 2500,
  experience: 2000,
  education: 1500,
  skills: 1000,
  headline: 1000,
  location: 500,
  phone: 500,
  links: 500,
  certifications: 500,
};

/** Skills reach full credit at this many. */
export const SKILLS_FOR_FULL_CREDIT = 5;

export interface CompletenessRole {
  /** A start date plus an end date or "present" (the database requires both for every role). */
  dated: boolean;
  /** Per-role skill tags: the timeline engine's input (§7.7). */
  skillTags: number;
}

export interface CompletenessInput {
  headline?: string | null;
  location?: string | null;
  phone?: string | null;
  links: number;
  skills: number;
  education: number;
  certifications: number;
  roles: readonly CompletenessRole[];
}

export interface CompletenessItem {
  key: CompletenessKey;
  weightBps: Bps;
  earnedBps: Bps;
}

export interface Completeness {
  bps: Bps;
  /** Every item with what it earned, heaviest first. */
  items: CompletenessItem[];
  /** Items not yet at full credit, most points missing first. */
  missing: CompletenessItem[];
}

const filled = (value: string | null | undefined): boolean => (value ?? '').trim().length > 0;
const all = (key: CompletenessKey, on: boolean): Bps => (on ? COMPLETENESS_WEIGHTS[key] : 0);

function share(key: CompletenessKey, count: number, of: number): Bps {
  if (of <= 0) return 0;
  return divRoundHalfEven(COMPLETENESS_WEIGHTS[key] * Math.min(count, of), of);
}

export function profileCompleteness(input: CompletenessInput): Completeness {
  const dated = input.roles.filter((role) => role.dated);
  const tagged = dated.filter((role) => role.skillTags > 0).length;
  const earned: Record<CompletenessKey, Bps> = {
    role_skills: share('role_skills', tagged, dated.length),
    experience: all('experience', dated.length > 0),
    education: all('education', input.education > 0),
    skills: share('skills', input.skills, SKILLS_FOR_FULL_CREDIT),
    headline: all('headline', filled(input.headline)),
    location: all('location', filled(input.location)),
    phone: all('phone', filled(input.phone)),
    links: all('links', input.links > 0),
    certifications: all('certifications', input.certifications > 0),
  };
  const items = (Object.keys(COMPLETENESS_WEIGHTS) as CompletenessKey[]).map((key) => ({
    key,
    weightBps: COMPLETENESS_WEIGHTS[key],
    earnedBps: earned[key],
  }));
  const bps = Math.min(FULL_BPS, items.reduce((sum, item) => sum + item.earnedBps, 0));
  const missing = items
    .filter((item) => item.earnedBps < item.weightBps)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.weightBps - b.item.earnedBps - (a.item.weightBps - a.item.earnedBps) || a.index - b.index)
    .map(({ item }) => item);
  return { bps, items, missing };
}
