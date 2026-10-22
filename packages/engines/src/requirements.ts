/**
 * The requirement ledger (ImBackendImplementationPlan P8-06, old Q-04; V2 §7.8; D-14).
 *
 * - Coverage, not frequency: a requirement counts once however often either side repeats it.
 * - Required counts more than preferred (the rubric's `requirementWeight`).
 * - D-14's evidence tiers: demonstrated in a dated role (full credit), only listed (partial),
 *   unbacked (none). "5+ years" against fewer computed years is partial.
 * - Years are computed from the dated roles that carry the skill, overlaps counted once.
 * - Eligibility (work authorization, language, location, clearance) is a "may be screened out" flag
 *   and never moves points.
 * - The JD's wording is reported when the resume names the same skill differently, so the resume can
 *   mirror it ("PostgreSQL", not "Postgres").
 */

import { divRoundHalfEven, type Bps } from './bps';
import { monthRange, unionMonths, type DatedSpan, type PartialDate } from './dates';
import { findSkill, mentionsIn, resolveSkill, type SkillRef, type Taxonomy } from './normalizer';
import type { RubricVersion } from './provenance';
import { phraseKey, sentences, type Range } from './text';

export type Importance = 'required' | 'preferred';
export type EligibilityKind = 'work_authorization' | 'language' | 'location' | 'clearance';

export interface Requirement {
  id: string;
  kind: 'skill' | 'eligibility';
  importance: Importance;
  /** As the JD wrote it. */
  text: string;
  skill?: SkillRef;
  minYears?: number;
  eligibility?: EligibilityKind;
  /** Where the JD says it (offsets into the JD text), when found. */
  span?: Range;
}

export interface JdLists {
  requiredSkills: readonly string[];
  preferredSkills: readonly string[];
  tools?: readonly string[];
  rawText?: string;
}

const YEARS = /(\d{1,2})\s*\+?\s*(?:years?|yrs?|jahre|jahren)(?![\p{L}])/iu;

const ELIGIBILITY: readonly [EligibilityKind, readonly string[]][] = [
  ['work_authorization', ['authorized to work', 'authorised to work', 'work authorization', 'work authorisation', 'right to work', 'visa sponsorship', 'work permit', 'work visa', 'arbeitserlaubnis']],
  ['clearance', ['security clearance', 'clearance required', 'top secret', 'ts / sci']],
  ['location', ['must be located in', 'must be based in', 'must live in', 'must reside in', 'within commuting distance', 'relocate to', 'relocation to']],
];
const LANGUAGES = ['german', 'english', 'french', 'spanish', 'dutch', 'italian', 'deutsch', 'englisch'];
const FLUENCY = ['fluent', 'fluency', 'native', 'business level', 'verhandlungssicher', 'fließend', 'proficiency'];

const contains = (haystackKey: string, phrase: string) => ` ${haystackKey} `.includes(` ${phraseKey(phrase)} `);

function eligibilityIn(text: string): Requirement[] {
  const found = new Map<EligibilityKind, Requirement>();
  for (const range of sentences(text)) {
    const sentence = text.slice(range.start, range.end);
    const key = phraseKey(sentence);
    for (const [kind, phrases] of ELIGIBILITY) {
      if (!found.has(kind) && phrases.some((p) => contains(key, p))) {
        found.set(kind, { id: `elig:${kind}`, kind: 'eligibility', importance: 'required', text: sentence.trim(), eligibility: kind, span: range });
      }
    }
    if (!found.has('language') && LANGUAGES.some((l) => contains(key, l)) && FLUENCY.some((f) => contains(key, f))) {
      found.set('language', { id: 'elig:language', kind: 'eligibility', importance: 'required', text: sentence.trim(), eligibility: 'language', span: range });
    }
  }
  return [...found.values()];
}

/** Years asked per skill: "5+ years of experience with Python and Django" → both, 5. */
function yearsAsked(text: string, taxonomy: Taxonomy): Map<string, number> {
  const asked = new Map<string, number>();
  for (const range of sentences(text)) {
    const sentence = text.slice(range.start, range.end);
    const match = YEARS.exec(sentence);
    if (!match) continue;
    const after = match.index + match[0].length;
    for (const mention of mentionsIn(taxonomy, sentence)) {
      if (mention.start >= after && !asked.has(mention.skillId)) asked.set(mention.skillId, Number(match[1]));
    }
  }
  return asked;
}

/** Typed requirements from a JD's lists (P9 adds verified spans from the extractor). */
export function requirementsFromJd(jd: JdLists, taxonomy: Taxonomy): Requirement[] {
  const raw = jd.rawText ?? '';
  const asked = yearsAsked(raw, taxonomy);
  const out = new Map<string, Requirement>();
  const add = (written: string, importance: Importance) => {
    const text = written.trim();
    if (!text) return;
    const ownYears = YEARS.exec(text);
    const bare = ownYears ? text.replace(YEARS, '').replace(/^\s*(?:of|in|with)\s+/i, '').trim() : text;
    const skill = resolveSkill(taxonomy, bare || text);
    const existing = out.get(skill.id);
    if (existing) {
      if (importance === 'required') existing.importance = 'required';
      return;
    }
    const minYears = ownYears ? Number(ownYears[1]) : skill.known ? asked.get(skill.id) : undefined;
    const first = raw ? findSkill(taxonomy, raw, skill)[0] : undefined;
    out.set(skill.id, {
      id: `req:${skill.id}`,
      kind: 'skill',
      importance,
      text,
      skill,
      ...(minYears !== undefined ? { minYears } : {}),
      ...(first ? { span: { start: first.start, end: first.end } } : {}),
    });
  };
  jd.requiredSkills.forEach((s) => add(s, 'required'));
  jd.preferredSkills.forEach((s) => add(s, 'preferred'));
  (jd.tools ?? []).forEach((s) => add(s, 'preferred'));
  return [...out.values(), ...eligibilityIn(raw)];
}

/** What a resume (or a profile) shows for each skill. */
export interface EvidenceRole extends DatedSpan {
  id: string;
  /** Canonical ids of the skills the role carries (tags and mentions). */
  skills: readonly string[];
}

export interface Evidence {
  roles: readonly EvidenceRole[];
  /** Ids named outside any dated role: the skills section, the summary. */
  listed: readonly string[];
  /** How the document wrote each skill, for mirroring the JD's wording. */
  surfaces?: Readonly<Record<string, string>>;
}

export type EvidenceTier = 'demonstrated' | 'listed' | 'unbacked';
export type RequirementStatus = 'met' | 'partial' | 'gap' | 'eligibility';

export interface LedgerEntry {
  requirementId: string;
  kind: 'skill' | 'eligibility';
  importance: Importance;
  text: string;
  status: RequirementStatus;
  skillId?: string;
  tier?: EvidenceTier;
  creditBps?: Bps;
  /** `capped`: the JD asked more years than the technology has existed; this is what was measured. */
  years?: { asked: number; shownMonths: number; capped?: number };
  /** Roles that demonstrate it. */
  roleIds: string[];
  /** Set when the resume names the skill differently from the JD. */
  wording?: { jd: string; resume: string };
  span?: Range;
}

export interface RequirementLedger {
  entries: LedgerEntry[];
  /** The keyword component and the JD match %: null when the JD names no skill. */
  matchBps: Bps | null;
  counts: {
    requiredMet: number;
    requiredPartial: number;
    requiredTotal: number;
    preferredMet: number;
    preferredPartial: number;
    preferredTotal: number;
  };
}

const TIER_ORDER: Record<EvidenceTier, number> = { unbacked: 0, listed: 1, demonstrated: 2 };

/** The best evidence a document (or profile) shows for a skill, and the dated roles behind it. */
export function evidenceTier(evidence: Evidence, skillId: string): { tier: EvidenceTier; roleIds: string[] } {
  const roleIds = evidence.roles.filter((r) => r.start && r.skills.includes(skillId)).map((r) => r.id);
  if (roleIds.length > 0) return { tier: 'demonstrated', roleIds };
  const listed = evidence.listed.includes(skillId) || evidence.roles.some((r) => r.skills.includes(skillId));
  return { tier: listed ? 'listed' : 'unbacked', roleIds: [] };
}

function monthsShown(evidence: Evidence, skillId: string, asOf: PartialDate): number {
  const ranges = evidence.roles
    .filter((r) => r.skills.includes(skillId))
    .map((r) => monthRange(r, asOf))
    .filter((r): r is [number, number] => r !== null);
  return unionMonths(ranges);
}

/**
 * Builds the ledger. `backing` is the yardstick for a generated resume (the profile): a skill the
 * document shows earns only as much as the profile backs it (G16). For an upload, leave it out and
 * the document's own dated roles are the yardstick.
 */
export function buildLedger(input: {
  requirements: readonly Requirement[];
  evidence: Evidence;
  backing?: Evidence;
  rubric: RubricVersion;
  asOf: PartialDate;
  /** Per skill, the most years a JD may fairly ask (`plausibility.yearsCeilings`). */
  yearsCeiling?: Readonly<Record<string, number>>;
}): RequirementLedger {
  const { requirements, evidence, backing, rubric, asOf } = input;
  const entries: LedgerEntry[] = [];
  let weighted = 0;
  let weights = 0;
  const counts = { requiredMet: 0, requiredPartial: 0, requiredTotal: 0, preferredMet: 0, preferredPartial: 0, preferredTotal: 0 };

  for (const req of requirements) {
    if (req.kind === 'eligibility' || !req.skill) {
      entries.push({ requirementId: req.id, kind: 'eligibility', importance: req.importance, text: req.text, status: 'eligibility', roleIds: [], ...(req.span ? { span: req.span } : {}) });
      continue;
    }
    const skillId = req.skill.id;
    const doc = evidenceTier(evidence, skillId);
    const backed = backing ? evidenceTier(backing, skillId) : doc;
    const tier = TIER_ORDER[backed.tier] < TIER_ORDER[doc.tier] ? backed.tier : doc.tier;
    let shown = monthsShown(evidence, skillId, asOf);
    if (backing) shown = Math.min(shown, monthsShown(backing, skillId, asOf));
    const ceiling = input.yearsCeiling?.[skillId];
    const askedYears = req.minYears === undefined ? undefined : ceiling === undefined ? req.minYears : Math.min(req.minYears, ceiling);
    const short = askedYears !== undefined && tier === 'demonstrated' && shown < askedYears * 12;

    let status: RequirementStatus;
    let creditBps: Bps;
    if (tier === 'unbacked') [status, creditBps] = ['gap', rubric.credit.unbacked];
    else if (tier === 'listed') [status, creditBps] = ['partial', rubric.credit.listed];
    else if (short) [status, creditBps] = ['partial', rubric.credit.yearsShort];
    else [status, creditBps] = ['met', rubric.credit.demonstrated];

    const weight = req.importance === 'required' ? rubric.requirementWeight.required : rubric.requirementWeight.preferred;
    weighted += weight * creditBps;
    weights += weight;
    const prefix = req.importance === 'required' ? 'required' : 'preferred';
    counts[`${prefix}Total`] += 1;
    if (status === 'met') counts[`${prefix}Met`] += 1;
    if (status === 'partial') counts[`${prefix}Partial`] += 1;

    const resumeWording = evidence.surfaces?.[skillId];
    const jdWording = req.skill.known ? req.text : req.skill.name;
    const wording =
      status !== 'gap' && resumeWording && phraseKey(resumeWording) !== phraseKey(jdWording)
        ? { jd: jdWording, resume: resumeWording }
        : undefined;

    entries.push({
      requirementId: req.id,
      kind: 'skill',
      importance: req.importance,
      text: req.text,
      status,
      skillId,
      tier,
      creditBps,
      ...(req.minYears !== undefined
        ? { years: { asked: req.minYears, shownMonths: shown, ...(askedYears !== req.minYears ? { capped: askedYears } : {}) } }
        : {}),
      roleIds: tier === 'demonstrated' ? doc.roleIds : [],
      ...(wording ? { wording } : {}),
      ...(req.span ? { span: req.span } : {}),
    });
  }

  return { entries, matchBps: weights > 0 ? divRoundHalfEven(weighted, weights) : null, counts };
}
