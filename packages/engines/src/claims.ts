/**
 * The claim ledger and verifier (ImBackendImplementationPlan P9-04, old Q-03; G13). Every claim on
 * a generated document is checked, deterministically, against the profile facts it cites:
 *
 * - **Traceable:** a generated claim cites facts, and every cited fact exists.
 * - **No moved achievements:** a bullet under a role cites only that role's facts.
 * - **Entity integrity:** employer, title, dates, degree, institution and certification read
 *   exactly as the facts do. Titles are facts; they are never rewritten to match a JD.
 * - **Numeric integrity:** every number is in the cited facts or a whitelisted derivation (sums,
 *   differences and ratios of cited numbers; years from the role's dates).
 * - **"N years of X"** is checked against the dated roles tagged with X.
 * - **Technologies** a bullet names must be backed by that role and fit its dates (the timeline
 *   engine); a skill listed must be on the profile.
 * - A verb stronger than the facts support ("led", "architected") is flagged, not stripped.
 * - **Left out:** a tailored run's keywords the user chose not to add appear in no generated claim.
 *
 * Hard violations are what `stripHardFacts` removes after bounded regeneration; soft issues are
 * flagged. `user` claims are warned about and never stripped; `assumed` ones block export.
 */

import { divRoundHalfEven } from './bps';
import { monthRange, unionMonths, type PartialDate } from './dates';
import { factIndex, type CanonicalResume, type Claim, type ClaimOrigin, type ProfileFacts } from './facts';
import { TECHNOLOGY_CATEGORIES, type KnowledgeBase } from './kb';
import { leftOutChecker } from './leftOut';
import { mentionsIn, resolveSkill, skillById, type Mention, type Taxonomy } from './normalizer';
import { numbersIn, sameNumber } from './numbers';
import { techAge, yearsClaimsIn } from './plausibility';
import { phraseKey, tokenize } from './text';
import { validateTimeline, type EarlyAdoption } from './timeline';

export const CLAIM_LEDGER_VERSION = 'claims-1';

export type IssueCode =
  | 'untraceable'
  | 'moved_between_roles'
  | 'entity_mismatch'
  | 'date_mismatch'
  | 'number_not_in_facts'
  | 'years_overstated'
  | 'technology_not_backed'
  | 'anachronism'
  | 'skill_not_in_profile'
  | 'left_out_by_user'
  | 'verb_stronger_than_facts';

export interface Issue {
  code: IssueCode;
  severity: 'hard' | 'soft';
  detail: string;
}

export type ClaimWhere = 'summary' | 'skill' | 'bullet' | 'header' | 'education' | 'certification';

export interface ClaimResult {
  claimId: string;
  where: ClaimWhere;
  roleId?: string;
  origin: ClaimOrigin;
  status: 'verified' | 'flagged' | 'violation' | 'user_warned' | 'assumed';
  issues: Issue[];
}

export interface ClaimLedger {
  version: string;
  results: ClaimResult[];
  counts: { claims: number; verified: number; flagged: number; violations: number; userWarned: number; assumed: number };
  /** Hard facts (employers, dates, numbers, technologies) no fact backs, on generated claims. */
  untraceableHardFacts: number;
}

export interface LedgerInput {
  document: CanonicalResume;
  facts: ProfileFacts;
  taxonomy: Taxonomy;
  kb: KnowledgeBase;
  asOf: PartialDate;
  confirmations?: readonly EarlyAdoption[];
  /** A tailored run's unticked keywords: no generated claim may name one (`leftOut.ts`). */
  leftOut?: readonly string[];
}

const STRONG_VERBS = new Set(['led', 'owned', 'architected', 'spearheaded', 'headed', 'directed', 'founded', 'pioneered']);

const sameDate = (a: PartialDate | null | undefined, b: PartialDate | null | undefined) =>
  (a ?? null) === null ? (b ?? null) === null : b != null && a!.year === b.year && (a!.month === undefined || b.month === undefined || a!.month === b.month);

function durationYears(start: PartialDate, end: PartialDate | null, asOf: PartialDate): number {
  const range = monthRange({ start, end }, asOf);
  return range ? Math.floor((range[1] - range[0]) / 12) : 0;
}

/** Numbers a claim may state: those in its cited facts, and whitelisted derivations of them. */
function allowedNumbers(cited: number[], durations: number[]): number[] {
  const out = new Set<number>([...cited, ...durations]);
  for (const a of cited) {
    for (const b of cited) {
      out.add(a + b);
      out.add(Math.abs(a - b));
      if (b !== 0 && Number.isSafeInteger(Math.round(a * 100))) {
        out.add(Math.round((100 * a) / b));
        out.add(Math.round((100 * Math.abs(a - b)) / b));
        out.add(Math.round((a / b) * 10) / 10);
        out.add(Math.round(a / b));
      }
    }
  }
  return [...out];
}

export function buildClaimLedger(input: LedgerInput): ClaimLedger {
  const { document: doc, facts, taxonomy } = input;
  // Technology claims only: practices and domains ("payment systems") are not checked as tools.
  const technologies = (text: string): Mention[] =>
    mentionsIn(taxonomy, text).filter((m) => TECHNOLOGY_CATEGORIES.has(skillById(taxonomy, m.skillId)?.category ?? 'practice'));
  const index = factIndex(facts);
  const rolesById = new Map(facts.roles.map((r) => [r.id, r]));
  const profileSkillIds = new Set([...facts.skills, ...facts.roles.flatMap((r) => r.skills)].map((s) => resolveSkill(taxonomy, s).id));
  const results: ClaimResult[] = [];
  const monthsWith = (skillId: string) =>
    unionMonths(
      facts.roles
        .filter((r) => r.skills.some((s) => resolveSkill(taxonomy, s).id === skillId))
        .map((r) => monthRange(r, input.asOf))
        .filter((r): r is [number, number] => r !== null),
    );
  const timeline = validateTimeline({
    roles: doc.roles.map((r) => {
      const fact = rolesById.get(r.roleId);
      return { id: r.roleId, start: fact?.start ?? r.start, end: fact ? fact.end : r.end, text: r.bullets.map((b) => b.text).join('\n') };
    }),
    kb: input.kb,
    taxonomy,
    asOf: input.asOf,
    confirmations: input.confirmations,
  });

  const finish = (claimId: string, where: ClaimWhere, origin: ClaimOrigin, issues: Issue[], roleId?: string) => {
    const hard = issues.some((i) => i.severity === 'hard');
    const status: ClaimResult['status'] =
      origin === 'assumed' ? 'assumed' : origin === 'user' && issues.length ? 'user_warned' : hard ? 'violation' : issues.length ? 'flagged' : 'verified';
    results.push({ claimId, where, origin, status, issues, ...(roleId ? { roleId } : {}) });
  };

  const checkNumbers = (claim: Claim, issues: Issue[], durations: number[]) => {
    const cited = claim.evidence.flatMap((id) => numbersIn(index.get(id)?.text ?? '', taxonomy).map((n) => n.value));
    const allowed = allowedNumbers(cited, durations);
    for (const n of numbersIn(claim.text, taxonomy)) {
      if (!allowed.some((a) => sameNumber(a, n.value))) issues.push({ code: 'number_not_in_facts', severity: 'hard', detail: `"${n.raw}" is not in the facts this cites` });
    }
  };

  const checkTraceable = (claim: Claim, issues: Issue[]) => {
    if (claim.origin !== 'generated') return;
    if (claim.evidence.length === 0) issues.push({ code: 'untraceable', severity: 'hard', detail: 'cites no fact' });
    for (const id of claim.evidence) if (!index.has(id)) issues.push({ code: 'untraceable', severity: 'hard', detail: `cites a fact that does not exist (${id})` });
  };
  const namesLeftOut = leftOutChecker(taxonomy, input.leftOut ?? []);
  const checkLeftOut = (claim: Claim, text: string, issues: Issue[]) => {
    if (claim.origin !== 'generated') return;
    for (const phrase of namesLeftOut(text)) issues.push({ code: 'left_out_by_user', severity: 'hard', detail: `"${phrase}" was left out by the user` });
  };

  // Roles: the header facts, then each bullet.
  for (const role of doc.roles) {
    const fact = rolesById.get(role.roleId);
    const header: Issue[] = [];
    if (!fact) header.push({ code: 'untraceable', severity: 'hard', detail: 'this role is not on the profile' });
    else {
      if (phraseKey(role.company) !== phraseKey(fact.company)) header.push({ code: 'entity_mismatch', severity: 'hard', detail: `employer reads "${role.company}", the profile says "${fact.company}"` });
      if (phraseKey(role.title) !== phraseKey(fact.title)) header.push({ code: 'entity_mismatch', severity: 'hard', detail: `title reads "${role.title}", the profile says "${fact.title}"` });
      if (!sameDate(role.start, fact.start) || !sameDate(role.end, fact.end)) header.push({ code: 'date_mismatch', severity: 'hard', detail: 'dates differ from the profile' });
    }
    finish(`header:${role.roleId}`, 'header', 'generated', header, role.roleId);

    const roleDuration = fact ? [durationYears(fact.start, fact.end, input.asOf)] : [];
    for (const bullet of role.bullets) {
      const issues: Issue[] = [];
      checkTraceable(bullet, issues);
      checkLeftOut(bullet, bullet.text, issues);
      for (const id of bullet.evidence) {
        const owner = index.get(id)?.roleId;
        if (owner && owner !== role.roleId) issues.push({ code: 'moved_between_roles', severity: 'hard', detail: `cites a fact from another role (${id})` });
      }
      checkNumbers(bullet, issues, roleDuration);
      const backedText = fact ? [fact.description ?? '', ...fact.responsibilities].join('\n') : '';
      const backed = new Set([...(fact?.skills ?? []).map((s) => resolveSkill(taxonomy, s).id), ...mentionsIn(taxonomy, backedText).map((m) => m.skillId)]);
      for (const m of technologies(bullet.text)) {
        if (!backed.has(m.skillId)) issues.push({ code: 'technology_not_backed', severity: 'hard', detail: `"${m.surface}" is not on this role in the profile` });
        const pair = timeline.pairs.find((p) => p.roleId === role.roleId && p.skillId === m.skillId);
        if (pair && !pair.included) issues.push({ code: 'anachronism', severity: 'hard', detail: `"${m.surface}" does not fit this role's dates` });
      }
      const first = tokenize(bullet.text).find((t) => t.kind === 'word')?.key;
      if (first && STRONG_VERBS.has(first)) {
        const cited = bullet.evidence.map((id) => index.get(id)?.text ?? '').join(' ');
        if (!tokenize(cited).some((t) => STRONG_VERBS.has(t.key))) issues.push({ code: 'verb_stronger_than_facts', severity: 'soft', detail: `"${first}" is stronger than the facts say` });
      }
      finish(bullet.id, 'bullet', bullet.origin, issues, role.roleId);
    }
  }

  // The summary: numbers (total years allowed), "N years of X", technologies on the profile.
  if (doc.summary) {
    const issues: Issue[] = [];
    checkTraceable(doc.summary, issues);
    checkLeftOut(doc.summary, doc.summary.text, issues);
    const allMonths = unionMonths(facts.roles.map((r) => monthRange(r, input.asOf)).filter((r): r is [number, number] => r !== null));
    // Years from dates are whitelisted: overall, per role, and per skill from the roles tagged with it.
    const skillYears = [...profileSkillIds].map((id) => Math.floor(monthsWith(id) / 12));
    const roleYears = facts.roles.map((r) => durationYears(r.start, r.end, input.asOf));
    checkNumbers(doc.summary, issues, [Math.floor(allMonths / 12), ...roleYears, ...skillYears]);
    for (const claim of yearsClaimsIn(doc.summary.text, taxonomy)) {
      const months = monthsWith(claim.skill.id);
      if (claim.years > Math.floor(months / 12)) issues.push({ code: 'years_overstated', severity: 'hard', detail: `${claim.years} years of ${claim.skill.name}; the dated roles show ${divRoundHalfEven(months * 10, 12) / 10}` });
      const age = techAge(input.kb, claim.skill.id, input.asOf);
      if (age && claim.years > age.maxYears) issues.push({ code: 'years_overstated', severity: 'hard', detail: `${claim.years} years of ${claim.skill.name}; it was released in ${age.releaseYear}` });
    }
    for (const m of technologies(doc.summary.text)) {
      if (!profileSkillIds.has(m.skillId)) issues.push({ code: 'technology_not_backed', severity: 'hard', detail: `"${m.surface}" is not on the profile` });
    }
    finish(doc.summary.id, 'summary', doc.summary.origin, issues);
  }

  for (const skill of doc.skills) {
    const issues: Issue[] = profileSkillIds.has(resolveSkill(taxonomy, skill.name).id) ? [] : [{ code: 'skill_not_in_profile', severity: 'hard', detail: `"${skill.name}" is not on the profile` }];
    checkLeftOut(skill, skill.name, issues);
    finish(skill.id, 'skill', skill.origin, issues);
  }
  for (const e of doc.education) {
    const fact = facts.education.find((f) => f.id === e.factId);
    const ok = fact && phraseKey(fact.institution) === phraseKey(e.institution) && phraseKey(fact.degree) === phraseKey(e.degree);
    finish(`education:${e.factId}`, 'education', 'generated', ok ? [] : [{ code: 'entity_mismatch', severity: 'hard', detail: 'degree or institution differs from the profile' }]);
  }
  for (const c of doc.certifications) {
    const fact = facts.certifications.find((f) => f.id === c.factId);
    finish(`certification:${c.factId}`, 'certification', 'generated', fact && phraseKey(fact.name) === phraseKey(c.name) ? [] : [{ code: 'entity_mismatch', severity: 'hard', detail: 'certification differs from the profile' }]);
  }

  const count = (s: ClaimResult['status']) => results.filter((r) => r.status === s).length;
  return {
    version: CLAIM_LEDGER_VERSION,
    results,
    counts: { claims: results.length, verified: count('verified'), flagged: count('flagged'), violations: count('violation'), userWarned: count('user_warned'), assumed: count('assumed') },
    // A left-out keyword is the user's choice, not an untraceable fact; it is still stripped.
    untraceableHardFacts: results.filter((r) => r.status === 'violation').reduce((n, r) => n + r.issues.filter((i) => i.severity === 'hard' && i.code !== 'left_out_by_user').length, 0),
  };
}

/** Claim ids with a hard violation, by section: what bounded regeneration targets first. */
export function violatingSections(ledger: ClaimLedger): { summary: boolean; skills: boolean; roleIds: string[] } {
  const v = ledger.results.filter((r) => r.status === 'violation');
  return {
    summary: v.some((r) => r.where === 'summary'),
    skills: v.some((r) => r.where === 'skill'),
    roleIds: [...new Set(v.filter((r) => r.where === 'bullet' || r.where === 'header').map((r) => r.roleId!))],
  };
}

/**
 * After bounded regeneration: invented hard facts are removed (G13, §7.6 "contains no" such
 * claim). Violating bullets, skills and summaries go; a role's header is reset to the profile's
 * facts, since titles, employers and dates are facts. User claims are never touched.
 */
export function stripHardFacts(doc: CanonicalResume, ledger: ClaimLedger, facts: ProfileFacts): { document: CanonicalResume; stripped: { claimId: string; reason: IssueCode }[] } {
  const bad = new Map(ledger.results.filter((r) => r.status === 'violation').map((r) => [r.claimId, r.issues.find((i) => i.severity === 'hard')!.code]));
  const stripped = [...bad].map(([claimId, reason]) => ({ claimId, reason }));
  const rolesById = new Map(facts.roles.map((r) => [r.id, r]));
  return {
    document: {
      ...doc,
      ...(doc.summary && bad.has(doc.summary.id) ? { summary: undefined } : {}),
      skills: doc.skills.filter((s) => !bad.has(s.id)),
      roles: doc.roles
        .filter((r) => rolesById.has(r.roleId))
        .map((r) => {
          const fact = rolesById.get(r.roleId)!;
          const header = bad.has(`header:${r.roleId}`) ? { company: fact.company, title: fact.title, start: fact.start, end: fact.end } : {};
          return { ...r, ...header, bullets: r.bullets.filter((b) => !bad.has(b.id)) };
        }),
      education: doc.education.filter((e) => !bad.has(`education:${e.factId}`)),
      certifications: doc.certifications.filter((c) => !bad.has(`certification:${c.factId}`)),
    },
    stripped,
  };
}
