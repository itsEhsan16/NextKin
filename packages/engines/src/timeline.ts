/**
 * The Timeline Validation Engine (V2 §7.7, §16.2; ImBackendImplementationPlan P8-04, old M2-08).
 *
 * Every technology attached to a role — a profile tag or a mention in the role's text — is checked
 * against the role's dates:
 * - **Invalid** (hard fail): the role ends before the technology's release year. It never ships.
 * - **Suspect** (flag): the role ends inside [release, safe usage). Excluded by default; included
 *   only with a recorded confirmation of genuine early adoption.
 * - **Valid**: the role reaches the safe-usage year.
 * - **Unverified**: no KB entry. Never blocked; flagged and queued for review.
 *
 * Only an approved KB entry may produce Invalid; a machine-generated one reports what would be
 * Invalid as Suspect (§7.7, P8-03). `asOf` stands in for "present" and is an argument, never the
 * clock, so the same input and KB version give the same report every time (G12).
 *
 * The same function is the pre-filter (the era-valid skill set per role, which constrains the
 * generator) and the post-check (re-validating the mentions in generated text).
 */

import { compareCodePoints } from './bps';
import { endYear, formatPartialDate, spansOverlap, type DatedSpan, type PartialDate } from './dates';
import { isAuthoritative, kbEntry, TECHNOLOGY_CATEGORIES, type KbReviewState, type KnowledgeBase } from './kb';
import { mentionsIn, resolveSkill, skillById, type Taxonomy } from './normalizer';
import { suggestSubstitutions, type Substitution } from './substitutions';

export type TimelineVerdict = 'invalid' | 'suspect' | 'valid' | 'unverified';

export type TimelineRule =
  | 'ends_before_release'
  | 'ends_before_release_unapproved'
  | 'before_safe_usage'
  | 'reaches_safe_usage'
  | 'not_in_kb'
  | 'not_in_taxonomy'
  | 'role_end_unknown';

export interface TimelineRole extends DatedSpan {
  id: string;
  /** Skills as written on the role (profile tags). */
  skills?: readonly string[];
  /** The role's text (title, bullets): technology mentions are read out of it. */
  text?: string;
}

export interface EarlyAdoption {
  roleId: string;
  skillId: string;
}

export interface TimelineInput {
  roles: readonly TimelineRole[];
  kb: KnowledgeBase;
  taxonomy: Taxonomy;
  /** "Present" for open-ended roles. Recorded on the report. */
  asOf: PartialDate;
  /** Recorded confirmations of genuine early adoption (§7.7). */
  confirmations?: readonly EarlyAdoption[];
}

export interface TimelinePair {
  roleId: string;
  skillId: string;
  name: string;
  /** How the role wrote it. */
  surface: string;
  source: 'tag' | 'text';
  verdict: TimelineVerdict;
  rule: TimelineRule;
  /** An Invalid verdict: the claim may not ship. */
  hardFail: boolean;
  /** Whether the claim may appear in generated output. */
  included: boolean;
  confirmed: boolean;
  roleEndYear: number | null;
  /** The KB data the verdict rests on, as it stood at `kbVersion`. */
  kb?: { releaseYear: number; safeUsageYear: number; enterpriseAdoptionYear: number; reviewState: KbReviewState };
  substitutions: Substitution[];
}

export interface TimelineReport {
  kbVersion: string;
  taxonomyVersion: string;
  asOf: string;
  pairs: TimelinePair[];
  counts: { checked: number; valid: number; suspect: number; invalid: number; unverified: number };
  /** Invalid claims still present: any one zeroes the rubric's timeline component. */
  unresolvedHardFails: number;
  /** Names to add to the KB review queue (§7.7). */
  reviewQueue: string[];
}

interface Claim {
  skillId: string;
  name: string;
  surface: string;
  source: 'tag' | 'text';
  known: boolean;
}

/** The technology claims on one role: its tags, then mentions in its text, each skill once. */
function claimsOf(role: TimelineRole, taxonomy: Taxonomy): Claim[] {
  const claims = new Map<string, Claim>();
  for (const written of role.skills ?? []) {
    const ref = resolveSkill(taxonomy, written);
    if (!claims.has(ref.id)) claims.set(ref.id, { skillId: ref.id, name: ref.name, surface: written, source: 'tag', known: ref.known });
  }
  for (const mention of role.text ? mentionsIn(taxonomy, role.text) : []) {
    if (!claims.has(mention.skillId)) {
      claims.set(mention.skillId, { skillId: mention.skillId, name: mention.name, surface: mention.surface, source: 'text', known: true });
    }
  }
  return [...claims.values()].filter((claim) => {
    if (!claim.known) return true;
    const skill = skillById(taxonomy, claim.skillId);
    return skill !== undefined && TECHNOLOGY_CATEGORIES.has(skill.category);
  });
}

type Judged = Omit<TimelinePair, 'substitutions' | 'included' | 'confirmed' | 'roleId' | 'surface' | 'source' | 'name' | 'skillId'>;

function judge(claim: Claim, roleEnd: number | null, kb: KnowledgeBase): Judged {
  if (!claim.known) return { verdict: 'unverified', rule: 'not_in_taxonomy', hardFail: false, roleEndYear: roleEnd };
  const entry = kbEntry(kb, claim.skillId);
  if (!entry) return { verdict: 'unverified', rule: 'not_in_kb', hardFail: false, roleEndYear: roleEnd };
  const data = {
    releaseYear: entry.releaseYear,
    safeUsageYear: entry.safeUsageYear,
    enterpriseAdoptionYear: entry.enterpriseAdoptionYear,
    reviewState: entry.reviewState,
  };
  if (roleEnd === null) return { verdict: 'unverified', rule: 'role_end_unknown', hardFail: false, roleEndYear: null, kb: data };
  if (roleEnd < entry.releaseYear) {
    return isAuthoritative(entry)
      ? { verdict: 'invalid', rule: 'ends_before_release', hardFail: true, roleEndYear: roleEnd, kb: data }
      : { verdict: 'suspect', rule: 'ends_before_release_unapproved', hardFail: false, roleEndYear: roleEnd, kb: data };
  }
  if (roleEnd < entry.safeUsageYear) {
    return { verdict: 'suspect', rule: 'before_safe_usage', hardFail: false, roleEndYear: roleEnd, kb: data };
  }
  return { verdict: 'valid', rule: 'reaches_safe_usage', hardFail: false, roleEndYear: roleEnd, kb: data };
}

export function validateTimeline(input: TimelineInput): TimelineReport {
  const { roles, kb, taxonomy, asOf } = input;
  const confirmed = new Set((input.confirmations ?? []).map((c) => `${c.roleId}\u0000${c.skillId}`));

  const judged = roles.map((role) => {
    const roleEnd = endYear(role, asOf);
    return {
      role,
      pairs: claimsOf(role, taxonomy)
        .sort((a, b) => compareCodePoints(a.skillId, b.skillId))
        .map((claim) => {
          const verdict = judge(claim, roleEnd, kb);
          const isConfirmed = verdict.verdict === 'suspect' && confirmed.has(`${role.id}\u0000${claim.skillId}`);
          const included = verdict.verdict === 'valid' || verdict.verdict === 'unverified' || isConfirmed;
          return {
            roleId: role.id,
            skillId: claim.skillId,
            name: claim.name,
            surface: claim.surface,
            source: claim.source,
            ...verdict,
            included,
            confirmed: isConfirmed,
            substitutions: [] as Substitution[],
          };
        }),
    };
  });

  // Substitutions need every role's verdicts: the candidate's own valid skills from overlapping
  // periods come first (§7.7).
  for (const { role, pairs } of judged) {
    for (const pair of pairs) {
      if (pair.included || pair.roleEndYear === null) continue;
      const own = judged
        .filter((other) => other.role.id === role.id || spansOverlap(other.role, role, asOf))
        .flatMap((other) => other.pairs)
        .filter((p) => p.verdict === 'valid')
        .map((p) => p.skillId);
      pair.substitutions = suggestSubstitutions({ skillId: pair.skillId, roleEndYear: pair.roleEndYear, ownValid: own, kb, taxonomy });
    }
  }

  const pairs = judged.flatMap((j) => j.pairs);
  const count = (verdict: TimelineVerdict) => pairs.filter((p) => p.verdict === verdict).length;
  return {
    kbVersion: kb.version,
    taxonomyVersion: taxonomy.version,
    asOf: formatPartialDate(asOf),
    pairs,
    counts: {
      checked: pairs.length,
      valid: count('valid'),
      suspect: count('suspect'),
      invalid: count('invalid'),
      unverified: count('unverified'),
    },
    unresolvedHardFails: pairs.filter((p) => p.hardFail).length,
    reviewQueue: [
      ...new Set(pairs.filter((p) => p.rule === 'not_in_kb' || p.rule === 'not_in_taxonomy').map((p) => p.name)),
    ].sort(compareCodePoints),
  };
}

/**
 * The pre-filter: per role, the skills a generator may use — valid, unverified (flagged, never
 * blocked) or confirmed early adoption (§7.7).
 */
export function eraValidSkills(input: TimelineInput): Record<string, string[]> {
  const report = validateTimeline(input);
  const out: Record<string, string[]> = {};
  for (const role of input.roles) out[role.id] = [];
  for (const pair of report.pairs) if (pair.included) out[pair.roleId]!.push(pair.skillId);
  return out;
}

/** The post-check's verdict on generated text: every claim that may not ship. */
export function violations(report: TimelineReport): TimelinePair[] {
  return report.pairs.filter((pair) => !pair.included);
}
