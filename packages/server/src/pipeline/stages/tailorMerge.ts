import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { leftOutChecker } from '@nextkin/engines/leftOut';
import { resolveSkill } from '@nextkin/engines/normalizer';
import { checkProjectBullets } from '@nextkin/engines/projectClaims';
import { toResumeContent } from '@nextkin/shared/scoring/canonical';
import { factsOfDocument, undatedRoleIds } from '@nextkin/shared/scoring/documentFacts';
import { estimatePages } from '@nextkin/shared/scoring/pages';
import { placeInGroups } from '@nextkin/shared/scoring/skillGroups';
import { reconcileStructure } from '@nextkin/shared/scoring/structure';
import type { CanonicalResumeJson, CanonicalRoleJson } from '@nextkin/shared/schemas/resumeContent';
import { z } from 'zod';

import { kept, keepFigures } from './tailorFigures';

/**
 * A tailored run's own rules (toreview §110.3), applied by code after the model wrote and the
 * validation loop checked (G14: the model proposes, code decides):
 * - a part the user switched off is the base version's, verbatim;
 * - a quick edit rewrites the two most recent roles and keeps the rest; a role with no start date
 *   is never rewritten; employers, titles and dates are never touched;
 * - the headline, when it is being aimed, is the job's title;
 * - the skills are the base's own (W-TAILOR 02's "Skill order"): with the fix on, the ones the job
 *   asks for move first, in the job's order; the keywords the user ticked are always listed;
 * - the page budget is met afterwards, on compiled pages (`pageFit.ts`, toreview §111.6);
 * - everything else is the base's, as its file had it (toreview §111): the header, skill lines,
 *   client projects, projects, schools, extra sections and the section order.
 * Kept lines cite their own line of the base version (the run's facts are that version).
 */

export const tailorRunSchema = z.object({
  baseResumeId: z.string(),
  baseVersionId: z.string(),
  fixes: z.array(z.enum(['headline', 'summary', 'skills', 'experience', 'projects', 'length'])),
  experience: z.enum(['quick', 'full']),
  added: z.array(z.string()),
  skipped: z.array(z.string()),
  baselineScore: z.number(),
  /** The comparison's job match, for the ready screen's "up from" (toreview §112). */
  baselineJobMatch: z.object({ matched: z.number(), total: z.number(), percent: z.number(), missing: z.array(z.string()), basis: z.string() }).optional(),
  sourcePages: z.number().optional(),
  /** Whether `sourcePages` was read off the uploaded file, or is the estimate. */
  sourceMeasured: z.boolean().optional(),
  /** Ticked keywords the user used at a role or project (toreview §112). */
  confirmed: z.array(z.object({ keyword: z.string(), where: z.string(), note: z.string().optional(), by: z.enum(['ai', 'you']).optional() })).optional(),
  /** Bullets the user rewrote with their real result (toreview §129); applied to the base. */
  figures: z.array(z.object({ where: z.string(), line: z.number(), text: z.string() })).optional(),
  /** The score the plan promised for these choices, re-scored at the start (toreview §129). */
  projected: z.number().optional(),
});
export type TailorRunInput = z.infer<typeof tailorRunSchema>;

/** A tailored run's request, as its start stored it (`services/tailorStart.ts`), or null. */
export const tailorOf = (run: Record<string, unknown>): TailorRunInput | null =>
  run.tailor === undefined ? null : tailorRunSchema.parse(run.tailor);

/** The job as the merge reads it: its title, and its skills in the job's order (required first). */
export interface TailorJob {
  title: string;
  skills: readonly string[];
}

const QUICK_ROLES = 2;

const keptRole = (role: CanonicalRoleJson, ri: number): CanonicalRoleJson => {
  const ids = new Map(role.bullets.map((b, bi) => [b.id, `kept-${ri}-${bi}`]));
  return {
    ...role,
    bullets: role.bullets.map((b, bi) => kept(b, ids.get(b.id)!, `${role.roleId}#r${bi}`)),
    // The file's client projects follow their bullets to the new ids.
    ...(role.entries ? { entries: role.entries.map((e) => ({ ...e, bulletIds: e.bulletIds.map((id) => ids.get(id) ?? id) })) } : {}),
  };
};

/** The base line a fact id names (`${roleId}#r${i}`), or undefined. */
const lineOf = (roleId: string, factId: string): number | undefined => {
  const prefix = `${roleId}#r`;
  if (!factId.startsWith(prefix)) return undefined;
  const n = Number(factId.slice(prefix.length));
  return Number.isInteger(n) ? n : undefined;
};

/**
 * A rewritten role keeps the file's client projects: each new bullet joins the project of the base
 * line it cites; one citing no grouped line stays with the role itself.
 */
function rewrittenRole(role: CanonicalRoleJson, bullets: CanonicalRoleJson['bullets']): CanonicalRoleJson {
  if (!role.entries) return { ...role, bullets };
  const entryOfLine = new Map<number, number>();
  role.bullets.forEach((b, bi) => {
    const at = role.entries!.findIndex((e) => e.bulletIds.includes(b.id));
    if (at >= 0) entryOfLine.set(bi, at);
  });
  const entries = role.entries.map((e) => ({ ...e, bulletIds: [] as string[] }));
  for (const bullet of bullets) {
    const line = bullet.evidence.map((id) => lineOf(role.roleId, id)).find((n) => n !== undefined);
    const at = line === undefined ? undefined : entryOfLine.get(line);
    if (at !== undefined) entries[at]!.bulletIds.push(bullet.id);
  }
  return { ...role, bullets, entries };
}

/** The two most recent dated roles: current ones first, then by start date. */
export function recentRoleIds(base: CanonicalResumeJson): Set<string> {
  return new Set(
    base.roles
      .filter((r) => r.start)
      .sort((a, b) => (b.end === null ? 1 : 0) - (a.end === null ? 1 : 0) || (b.start ?? '').localeCompare(a.start ?? ''))
      .slice(0, QUICK_ROLES)
      .map((r) => r.roleId),
  );
}

/** The roles this run rewrites: none with the experience fix off, never an undated one. */
export function rewrittenRoles(base: CanonicalResumeJson, request: TailorRunInput): Set<string> {
  if (!request.fixes.includes('experience')) return new Set();
  const undated = undatedRoleIds(base);
  const recent = recentRoleIds(base);
  // A role a keyword was confirmed at is rewritten too, so the keyword can be said there (§112).
  const confirmedAt = new Set((request.confirmed ?? []).map((c) => c.where));
  return new Set(base.roles.map((r) => r.roleId).filter((id) => !undated.has(id) && (request.experience === 'full' || recent.has(id) || confirmedAt.has(id))));
}

/**
 * The lines the validation loop stripped (G13) from parts this run uses. The record and "N lines
 * your resume doesn't back" count only those, not lines in a quick edit's discarded roles or the
 * model's skills list (the skills are the base's). The ids are `assemble`'s and the revision
 * merge's: `s`, `k<i>`, `b<role index>-<i>[-r<attempt>]`, where the role index is the facts' order,
 * which is the base's (`factsOfDocument`).
 */
export function strippedInUse<T extends { claimId: string }>(stripped: readonly T[], base: CanonicalResumeJson, request: TailorRunInput): T[] {
  const roles = rewrittenRoles(base, request);
  return stripped.filter(({ claimId }) => {
    if (claimId === 's') return request.fixes.includes('summary');
    if (/^k\d+$/.test(claimId)) return false;
    const bullet = /^b(\d+)-/.exec(claimId);
    return bullet ? roles.has(base.roles[Number(bullet[1])]?.roleId ?? '') : true;
  });
}

/** The estimated page count, for a resume no compile has measured. */
export const tailoredPages = (doc: CanonicalResumeJson) => estimatePages(toResumeContent(doc, { resumeId: 'x', versionId: 'x' }));

/**
 * The job's title as a headline: without what a posting adds in brackets ("(m/w/d)", "(Fresher,
 * Full-Stack Growth Path)"), and with a hyphen the copy turned into "?" restored (toreview §112).
 */
export const headlineOf = (jdTitle: string): string =>
  jdTitle
    .replace(/(?<=\p{L})\?(?=\p{L})/gu, '-')
    .replace(/\s*[([][^)\]]*[)\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

export const skillKey = (name: string) => resolveSkill(TAXONOMY, name).id;

/** The base's skills and the ticked ones; with `byJob`, those the job names first, in its order. */
function skillsFor(base: CanonicalResumeJson, request: TailorRunInput, job: TailorJob | null, byJob: boolean): CanonicalResumeJson['skills'] {
  const keys = new Set(base.skills.map((s) => skillKey(s.name)));
  const ticked = request.added
    .filter((name) => !keys.has(skillKey(name)))
    .map((name, i) => ({ id: `added-${i}`, name, evidence: [] as string[], origin: 'user' as const }));
  // The ledger reads a listed skill against the profile's skills, never its citations.
  const all = [...base.skills.map((s, i) => ({ ...s, id: `kept-k${i}` })), ...ticked];
  if (!byJob || !job) return all;
  const rank = new Map<string, number>();
  job.skills.forEach((name, i) => {
    const key = skillKey(name);
    if (!rank.has(key)) rank.set(key, i);
  });
  return all
    .map((skill, i) => ({ skill, i, r: rank.get(skillKey(skill.name)) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.skill);
}

/** The file's skill lines, each in the skills' new order when the job reordered them. */
function groupsFor(groups: NonNullable<CanonicalResumeJson['skillGroups']>, skills: CanonicalResumeJson['skills'], byJob: boolean): NonNullable<CanonicalResumeJson['skillGroups']> {
  if (!byJob) return groups;
  const rank = new Map(skills.map((s, i) => [s.name.toLowerCase(), i]));
  return groups.map((g) => ({ ...g, names: [...g.names].sort((a, b) => (rank.get(a.toLowerCase()) ?? 999) - (rank.get(b.toLowerCase()) ?? 999)) }));
}

/**
 * Projects (toreview §113): with the Projects fix on, a project takes the model's bullets only when
 * every one passes `checkProjectBullets` against that project's own lines; otherwise it keeps its
 * lines as the file had them. Kept lines cite their own line of the base.
 */
function projectsFor(base: CanonicalResumeJson, generated: CanonicalResumeJson, request: TailorRunInput): CanonicalResumeJson['projects'] {
  const facts = factsOfDocument(base, { ...(request.confirmed ? { confirmed: request.confirmed } : {}) });
  const leftOut = leftOutChecker(TAXONOMY, request.skipped);
  return base.projects.map((project, pi) => {
    const keptProject = { ...project, bullets: project.bullets.map((b, bi) => kept(b, `kept-p${pi}-${bi}`, `${project.factId}#p${bi}`)) };
    if (!request.fixes.includes('projects')) return keptProject;
    const bullets = generated.projects.find((g) => g.factId === project.factId)?.bullets ?? [];
    const own = facts.projects.find((f) => f.id === project.factId);
    if (bullets.length === 0 || !own) return keptProject;
    const issues = checkProjectBullets({ id: own.id, name: own.name, lines: own.lines ?? [], skills: own.skills ?? [] }, bullets, TAXONOMY, leftOut);
    return issues.length === 0 ? { ...project, bullets } : keptProject;
  });
}

export function mergeTailored(args: {
  base: CanonicalResumeJson;
  generated: CanonicalResumeJson;
  request: TailorRunInput;
  job: TailorJob | null;
}): CanonicalResumeJson {
  const { base, generated, request, job } = args;
  const fixes = new Set(request.fixes);
  const rewrites = rewrittenRoles(base, request);
  // The ticked keywords a text names (by canonical skill, else as whole words).
  const ticked = leftOutChecker(TAXONOMY, request.added);

  const target = job ? headlineOf(job.title) : '';
  const headline = fixes.has('headline') && target ? target : base.headline;
  const fresh = fixes.has('summary') ? generated.summary : undefined;
  const summary = fresh ?? (base.summary ? kept(base.summary, 'kept-s', 'profile#summary') : undefined);

  const roles = base.roles.map((role, ri) => {
    const rewritten = generated.roles.find((g) => g.roleId === role.roleId);
    // The header is the base's: employers, titles and dates are facts, never rewritten.
    const fresh = rewrites.has(role.roleId) && rewritten && rewritten.bullets.length > 0;
    const next = fresh ? keepFigures(role, rewrittenRole(role, rewritten.bullets), request.figures ?? [], ri) : keptRole(role, ri);
    // A keyword the user confirmed here, or one the AI placed in its lines (toreview §112, §116), is
    // one of the role's skills from now on — only where a line of the role says it.
    const placed = rewrites.has(role.roleId) ? ticked(next.bullets.map((b) => b.text).join('\n')) : [];
    const tags = [...(request.confirmed ?? []).filter((c) => c.where === role.roleId).map((c) => c.keyword), ...placed];
    return tags.length ? { ...next, skills: [...new Set([...next.skills, ...tags])] } : next;
  });

  // Everything not rewritten is the base's as its file had it (toreview §111), and a Zero Resume
  // draft's open questions stay open (V2 §7.9).
  const rest = structuredClone(base);
  delete rest.headline;
  delete rest.summary;
  const skills = skillsFor(base, request, job, fixes.has('skills')).slice(0, 60);
  const merged: CanonicalResumeJson = {
    ...rest,
    ...(headline ? { headline } : {}),
    ...(summary ? { summary } : {}),
    skills,
    // A ticked keyword goes on the file's skill line it belongs to, not under "Also" (toreview §113).
    ...(base.skillGroups ? { skillGroups: placeInGroups(groupsFor(base.skillGroups, skills, fixes.has('skills')), request.added, TAXONOMY) } : {}),
    roles,
    projects: projectsFor(base, generated, request),
  };
  return reconcileStructure(merged);
}
