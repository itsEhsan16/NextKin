/**
 * The Plausibility Engine: claims that cannot be true, on either side of a match.
 *
 * - **A JD** that asks for more years of a technology than the technology has existed ("20 years of
 *   React" when React shipped in 2013), or more years than a career holds.
 * - **A resume** whose summary claims more years of a technology than it has existed, whose roles
 *   use a technology before its release (the timeline engine's verdicts, not re-derived here), whose
 *   dates run backwards or start in the future, or whose stated total outruns its dated roles.
 *
 * Severity follows the KB rule the timeline engine uses (§7.7, toreview §105.15): only an approved
 * KB entry may call a technology claim **impossible**; a machine-generated one reports it as
 * **suspect**. Date arithmetic needs no KB, so a backwards range is always impossible. A technology
 * with no KB entry is never guessed at: it is skipped, not flagged. `asOf` stands in for "present"
 * and is an argument, never the clock (G12).
 */

import { compareCodePoints } from './bps';
import { formatPartialDate, monthIndex, monthRange, unionMonths, type DatedSpan, type PartialDate } from './dates';
import { isAuthoritative, kbEntry, type KnowledgeBase } from './kb';
import { resolveSkill, type SkillRef, type Taxonomy } from './normalizer';
import type { Requirement } from './requirements';
import { validateTimeline, type TimelineRole } from './timeline';

export const PLAUSIBILITY_VERSION = 'plausibility-1';

/** More years of anything than a working life holds. */
export const MAX_CAREER_YEARS = 40;
/** Slack between a stated total and the dated roles: a year of rounding or an undated stint. */
const TOTAL_SLACK_MONTHS = 12;

export type PlausibilityCode =
  | 'jd_years_exceed_tech_age'
  | 'jd_years_implausible'
  | 'claim_years_exceed_tech_age'
  | 'role_before_release'
  | 'end_before_start'
  | 'start_in_future'
  | 'stated_total_exceeds_roles';

export type PlausibilitySeverity = 'impossible' | 'suspect';

export interface PlausibilityFinding {
  code: PlausibilityCode;
  severity: PlausibilitySeverity;
  /** What the finding is about, as written: "React", a role id, "years of experience". */
  subject: string;
  skillId?: string;
  roleId?: string;
  requirementId?: string;
  /** The numbers the finding rests on (G17). */
  basis: {
    yearsAsked?: number;
    releaseYear?: number;
    /** The most years anyone could have, as of `asOf`. */
    maxYears?: number;
    shownMonths?: number;
    start?: string;
    end?: string;
  };
}

export interface PlausibilityReport {
  version: string;
  kbVersion: string;
  asOf: string;
  findings: PlausibilityFinding[];
  counts: { impossible: number; suspect: number };
}

/** How long a technology has existed, as of `asOf`, and whether that figure may decide (§7.7). */
export function techAge(kb: KnowledgeBase, skillId: string, asOf: PartialDate): { releaseYear: number; maxYears: number; authoritative: boolean } | undefined {
  const entry = kbEntry(kb, skillId);
  if (!entry) return undefined;
  return { releaseYear: entry.releaseYear, maxYears: Math.max(0, asOf.year - entry.releaseYear), authoritative: isAuthoritative(entry) };
}

const YEARS_OF = /(\d{1,2})\+?\s*years?\s+(?:of\s+|in\s+|with\s+)?(?:experience\s+(?:in|with)\s+)?([\p{L}\d.+#/ -]{1,40})/giu;

export interface YearsClaim {
  years: number;
  skill: SkillRef;
  /** The matched text, for the message. */
  raw: string;
}

/** "N years of X" phrases in a text whose X the taxonomy knows: the longest leading run that resolves. */
export function yearsClaimsIn(text: string, taxonomy: Taxonomy): YearsClaim[] {
  const out: YearsClaim[] = [];
  for (const match of text.matchAll(YEARS_OF)) {
    const words = match[2]!.replace(/[.,;:!?)]+.*$/, '').trim().split(/\s+/);
    for (let n = Math.min(words.length, 4); n > 0; n -= 1) {
      const ref = resolveSkill(taxonomy, words.slice(0, n).join(' '));
      if (ref.known) {
        out.push({ years: Number(match[1]), skill: ref, raw: match[0].trim() });
        break;
      }
    }
  }
  return out;
}

function overTechAge(
  code: 'jd_years_exceed_tech_age' | 'claim_years_exceed_tech_age',
  skill: SkillRef,
  years: number,
  kb: KnowledgeBase,
  asOf: PartialDate,
): PlausibilityFinding | undefined {
  const age = techAge(kb, skill.id, asOf);
  if (!age || years <= age.maxYears) return undefined;
  return {
    code,
    severity: age.authoritative ? 'impossible' : 'suspect',
    subject: skill.name,
    skillId: skill.id,
    basis: { yearsAsked: years, releaseYear: age.releaseYear, maxYears: age.maxYears },
  };
}

function report(kb: KnowledgeBase, asOf: PartialDate, findings: PlausibilityFinding[]): PlausibilityReport {
  const sorted = findings.sort(
    (a, b) => compareCodePoints(a.code, b.code) || compareCodePoints(a.subject, b.subject) || compareCodePoints(a.roleId ?? '', b.roleId ?? ''),
  );
  return {
    version: PLAUSIBILITY_VERSION,
    kbVersion: kb.version,
    asOf: formatPartialDate(asOf),
    findings: sorted,
    counts: {
      impossible: sorted.filter((f) => f.severity === 'impossible').length,
      suspect: sorted.filter((f) => f.severity === 'suspect').length,
    },
  };
}

/** A JD's years asks, each checked against the technology's age and a working life. */
export function checkJd(input: { requirements: readonly Requirement[]; kb: KnowledgeBase; asOf: PartialDate }): PlausibilityReport {
  const { requirements, kb, asOf } = input;
  const findings: PlausibilityFinding[] = [];
  for (const req of requirements) {
    if (req.kind !== 'skill' || !req.skill || req.minYears === undefined) continue;
    if (req.minYears > MAX_CAREER_YEARS) {
      findings.push({ code: 'jd_years_implausible', severity: 'impossible', subject: req.skill.name, skillId: req.skill.id, requirementId: req.id, basis: { yearsAsked: req.minYears, maxYears: MAX_CAREER_YEARS } });
      continue;
    }
    const finding = overTechAge('jd_years_exceed_tech_age', req.skill, req.minYears, kb, asOf);
    if (finding) findings.push({ ...finding, requirementId: req.id });
  }
  return report(kb, asOf, findings);
}

export interface ResumeRole extends TimelineRole {
  /** The employer and title, for messages. */
  label?: string;
}

export interface ResumeCheckInput {
  roles: readonly ResumeRole[];
  /** The summary (and any other free text that states "N years of X"). */
  text?: string;
  /** A total the person stated ("8 years of experience"), checked against the dated roles. */
  statedTotalYears?: number;
  kb: KnowledgeBase;
  taxonomy: Taxonomy;
  asOf: PartialDate;
}

const isBackwards = (span: DatedSpan) => !!span.start && !!span.end && monthIndex(span.end) < monthIndex(span.start);

/** A resume's or profile's dates and years claims. */
export function checkResume(input: ResumeCheckInput): PlausibilityReport {
  const { roles, kb, taxonomy, asOf } = input;
  const findings: PlausibilityFinding[] = [];
  const now = monthIndex(asOf);

  for (const role of roles) {
    const subject = role.label ?? role.id;
    const basis = { ...(role.start ? { start: formatPartialDate(role.start) } : {}), ...(role.end ? { end: formatPartialDate(role.end) } : {}) };
    if (isBackwards(role)) findings.push({ code: 'end_before_start', severity: 'impossible', subject, roleId: role.id, basis });
    if (role.start && monthIndex(role.start) > now) findings.push({ code: 'start_in_future', severity: 'impossible', subject, roleId: role.id, basis });
  }

  // Technology before its release: the timeline engine decides; this only reports its verdicts.
  const timeline = validateTimeline({ roles, kb, taxonomy, asOf });
  for (const pair of timeline.pairs) {
    if (pair.rule !== 'ends_before_release' && pair.rule !== 'ends_before_release_unapproved') continue;
    findings.push({
      code: 'role_before_release',
      severity: pair.hardFail ? 'impossible' : 'suspect',
      subject: pair.name,
      skillId: pair.skillId,
      roleId: pair.roleId,
      basis: { ...(pair.kb ? { releaseYear: pair.kb.releaseYear } : {}), ...(pair.roleEndYear !== null ? { end: String(pair.roleEndYear) } : {}) },
    });
  }

  const seen = new Set<string>();
  for (const claim of yearsClaimsIn(input.text ?? '', taxonomy)) {
    if (seen.has(claim.skill.id)) continue;
    const finding = overTechAge('claim_years_exceed_tech_age', claim.skill, claim.years, kb, asOf);
    if (finding) {
      seen.add(claim.skill.id);
      findings.push(finding);
    }
  }

  if (input.statedTotalYears !== undefined) {
    const shown = unionMonths(roles.filter((r) => !isBackwards(r)).map((r) => monthRange(r, asOf)).filter((r): r is [number, number] => r !== null));
    if (input.statedTotalYears * 12 > shown + TOTAL_SLACK_MONTHS) {
      findings.push({ code: 'stated_total_exceeds_roles', severity: 'suspect', subject: 'years of experience', basis: { yearsAsked: input.statedTotalYears, shownMonths: shown } });
    }
  }

  return report(kb, asOf, findings);
}

/** Per skill, the most years a JD may fairly ask: the technology's age, from any KB entry. */
export function yearsCeilings(requirements: readonly Requirement[], kb: KnowledgeBase, asOf: PartialDate): Record<string, number> {
  const out: Record<string, number> = {};
  for (const req of requirements) {
    if (!req.skill || req.minYears === undefined) continue;
    const age = techAge(kb, req.skill.id, asOf);
    const ceiling = Math.min(MAX_CAREER_YEARS, age?.maxYears ?? MAX_CAREER_YEARS);
    if (req.minYears > ceiling) out[req.skill.id] = ceiling;
  }
  return out;
}
