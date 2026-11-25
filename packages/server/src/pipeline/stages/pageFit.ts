import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { MARKETS, marketForLocation } from '@nextkin/engines/markets';
import { mentionsIn, resolveSkill } from '@nextkin/engines/normalizer';
import { isQuantified } from '@nextkin/engines/quantified';
import { toResumeContent } from '@nextkin/shared/scoring/canonical';
import { estimatePages } from '@nextkin/shared/scoring/pages';
import { reconcileStructure } from '@nextkin/shared/scoring/structure';
import type { CanonicalResumeJson, CanonicalRoleJson } from '@nextkin/shared/schemas/resumeContent';

import type { LatexCompiler } from '../../export/latex/compile';
import type { LatexDensity } from '../../export/latex/types';
import type { Identity as Who } from '../../export/model';
import { sourceOf } from '../../services/renders';
import { checkDeadline } from '../deadline';

/**
 * Fitting a tailored resume to its page budget (toreview §111.6), on the pages the download will
 * have: the merged document is typeset by the sealed compiler, as the render will typeset it.
 * Spacing is tightened first (densities 0–2). Only when that is not enough, and trimming is allowed,
 * whole items are left out, never rewritten.
 *
 * What may go, in this order (owner, 2026-11-25: "it should be able to remove and add things"):
 * 1. the resume's own skills that the job does not ask for and no line of the page uses;
 * 2. bullets under an extra section's entries (Extracurricular) that name none of the job's skills.
 *    A section's own lines stay, and so does all of a certifications section: those are credentials;
 * 3. bullets of roles and projects: the ones naming none of the job's skills first, a line without
 *    a number before one with, the oldest first, last line first. A recent role keeps three, any
 *    other role one, a project two;
 * 4. as the last resort: a project down to its one best line, then a whole entry of an extra section
 *    that names none of the job's skills.
 * A keyword the candidate accepted is one the job asks for, so it is never on the list (D-25).
 *
 * Nothing on the list is taken on trust: `safeRemovals` keeps an item only when the caller's check
 * says the document is worth as much without it (the score and the keyword match). If no amount of
 * safe trimming fits, nothing is left out: losing lines without reaching the goal helps no one.
 * Without a compiler the page count is the estimate, and only the length fix trims (as before).
 */

export type Measure = (doc: CanonicalResumeJson, density: LatexDensity) => Promise<number>;

/** One thing a fit may leave out: a skill by its name, or a line by where it is and its id. */
export type Removal =
  | { kind: 'skill'; name: string }
  | { kind: 'bullet'; in: 'role' | 'project' | 'section'; id: string }
  /** A whole entry of an extra section ("Coding Club, Core Member"), by its section and title. */
  | { kind: 'entry'; section: string; title: string };

const keyOf = (r: Removal) => (r.kind === 'skill' ? `s:${r.name}` : r.kind === 'entry' ? `e:${r.section}:${r.title}` : `${r.in}:${r.id}`);

export interface PageFit {
  doc: CanonicalResumeJson;
  density: LatexDensity;
  pages: number;
  /** How many items were left out, and which. */
  dropped: number;
  removed: Removal[];
  /** Whether `pages` came from a compile, or is the estimate. */
  compiled: boolean;
}

const RECENT_FLOOR = 3;
const PROJECT_FLOOR = 2;
const PROJECT_LAST = 1;
/** A section whose lines are credentials: nothing of it is ever left out. */
const CREDENTIALS = /certific|licen[cs]e|credential|award|honou?r|publication|patent/i;
const DENSITIES: LatexDensity[] = [0, 1, 2];

/**
 * Stands in for the name and contact while measuring, when the resume has no header of its own
 * (G5: the run has none); one line, as theirs. The name has letters that hang below the line: a
 * real compile showed "Your Name" set the header a hair shorter than a name with a g, p or y, and
 * that hair was one line of the page (2026-11-25). Measuring the taller case errs toward fitting.
 */
const PLACEHOLDER: Who = { name: 'Applying Candidate', email: 'name@example.com', phone: '+1 555 010 0100', location: 'City, Country' };

export const estimateMeasure: Measure = async (doc) => estimatePages(toResumeContent(doc, { resumeId: 'x', versionId: 'x' }));

/** Pages as the sealed service typesets them, with the market's date style, on the user's paper. */
export function compiledMeasure(latex: LatexCompiler, location: string | null, paper: 'letter' | 'a4' = 'letter'): Measure {
  const market = MARKETS.profiles[marketForLocation(location ?? undefined) ?? 'us'];
  return async (doc, density) => {
    const source = sourceOf(doc, PLACEHOLDER, { density, paper, market });
    if (!source.lint.ok) throw new Error('the template wrote TeX the lint refused');
    return (await latex.compile(source.tex)).pages;
  };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** How many of the skills a line names, as whole words ("Go" is not in "good"). */
const mentions = (text: string, skills: readonly string[]) =>
  skills.filter((s) => s.trim() && new RegExp(`(^|[^\\p{L}\\p{N}])${escape(s.trim())}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text)).length;

interface Line {
  id: string;
  in: 'role' | 'project';
  hits: number;
  figure: boolean;
  /** The position among the document's roles and projects by start date, oldest first. */
  age: number;
  at: number;
}

/** Fewest job skills named, then a line with no number, then the oldest, then the last line. */
const byWorth = (x: Line, y: Line) => x.hits - y.hits || Number(x.figure) - Number(y.figure) || x.age - y.age || y.at - x.at;

function bulletOrder(doc: CanonicalResumeJson, recent: ReadonlySet<string>, jobSkills: readonly string[], projects: boolean, projectFloor = PROJECT_FLOOR): Line[] {
  const dated = [...doc.roles.map((r) => ({ key: `r:${r.roleId}`, start: r.start ?? '' })), ...(projects ? doc.projects.map((p) => ({ key: `p:${p.factId}`, start: p.start ?? '' })) : [])];
  const age = new Map([...dated].sort((a, b) => a.start.localeCompare(b.start)).map((d, i) => [d.key, i]));
  const floor = (r: CanonicalRoleJson) => (recent.has(r.roleId) ? RECENT_FLOOR : 1);
  const lines = (bullets: CanonicalRoleJson['bullets'], where: Line['in'], key: string, keep: number): Line[] =>
    bullets
      .map((b, at) => ({ id: b.id, in: where, hits: mentions(b.text, jobSkills), figure: isQuantified(b.text, TAXONOMY), age: age.get(key) ?? 0, at }))
      .sort(byWorth)
      .slice(0, Math.max(0, bullets.length - keep));
  return [
    ...doc.roles.flatMap((role) => lines(role.bullets, 'role', `r:${role.roleId}`, floor(role))),
    ...(projects ? doc.projects.flatMap((p) => lines(p.bullets, 'project', `p:${p.factId}`, projectFloor)) : []),
  ].sort(byWorth);
}

/**
 * The role bullets that may go, in the order they go: fewest job skills named, then the oldest role,
 * then the role's last line. Each role keeps its floor, so the order never empties a role.
 */
export function dropOrder(doc: CanonicalResumeJson, recent: ReadonlySet<string>, jobSkills: readonly string[]): string[] {
  return bulletOrder(doc, recent, jobSkills, false).map((b) => b.id);
}

/** Every line of text the page prints outside its skills section. */
function pageText(doc: CanonicalResumeJson): string {
  return [
    doc.headline,
    doc.summary?.text,
    ...doc.roles.flatMap((r) => [...r.bullets.map((b) => b.text), ...(r.entries ?? []).flatMap((e) => [e.title, e.tech])]),
    ...doc.projects.flatMap((p) => [p.name, p.description, p.tech, ...p.bullets.map((b) => b.text)]),
    ...(doc.sections ?? []).flatMap((s) => [...s.lines.map((l) => l.text), ...s.entries.flatMap((e) => [e.title, e.subtitle, ...e.bullets.map((b) => b.text)])]),
    ...doc.certifications.map((c) => c.name),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * The resume's own skills nothing needs: the job does not ask for them, the candidate did not add
 * them for it, and no line of the page names them. Last listed first. None without a job to ask.
 */
export function spareSkills(doc: CanonicalResumeJson, jobSkills: readonly string[]): string[] {
  if (jobSkills.length === 0) return [];
  const asked = new Set(jobSkills.map((s) => resolveSkill(TAXONOMY, s).id));
  const text = pageText(doc);
  // By the skill as well as by its words: a project that says "React" uses the line's "React.js".
  const used = new Set(mentionsIn(TAXONOMY, text).map((m) => m.skillId));
  return doc.skills
    .filter((s) => !s.id.startsWith('added-') && !asked.has(resolveSkill(TAXONOMY, s.name).id) && !used.has(resolveSkill(TAXONOMY, s.name).id) && mentions(text, [s.name]) === 0)
    .map((s) => s.name)
    .reverse();
}

/** Everything a fit may leave out, cheapest first (see the head of this file). */
export function removalOrder(doc: CanonicalResumeJson, recent: ReadonlySet<string>, jobSkills: readonly string[]): Removal[] {
  const sections = (doc.sections ?? []).filter((s) => !CREDENTIALS.test(s.heading));
  const extra = sections
    .flatMap((s) => s.entries.flatMap((e) => e.bullets))
    .filter((b) => mentions(b.text, jobSkills) === 0)
    .reverse();
  const first = bulletOrder(doc, recent, jobSkills, true);
  const taken = new Set(first.map((b) => `${b.in}:${b.id}`));
  return [
    ...spareSkills(doc, jobSkills).map((name) => ({ kind: 'skill' as const, name })),
    ...extra.map((b) => ({ kind: 'bullet' as const, in: 'section' as const, id: b.id })),
    ...first.map((b) => ({ kind: 'bullet' as const, in: b.in, id: b.id })),
    // The last resort: a project down to its one best line.
    ...bulletOrder(doc, recent, jobSkills, true, PROJECT_LAST)
      .filter((b) => !taken.has(`${b.in}:${b.id}`))
      .map((b) => ({ kind: 'bullet' as const, in: b.in, id: b.id })),
    ...sections.flatMap((s) =>
      s.entries.filter((e) => mentions([e.title, e.subtitle ?? '', ...e.bullets.map((b) => b.text)].join(' | '), jobSkills) === 0).map((e) => ({ kind: 'entry' as const, section: s.id, title: e.title })),
    ),
  ];
}

/** The document without these: a skill leaves its skill line too, a bullet its client project. */
export function without(doc: CanonicalResumeJson, removals: readonly Removal[]): CanonicalResumeJson {
  if (removals.length === 0) return doc;
  const skills = new Set(removals.flatMap((r) => (r.kind === 'skill' ? [r.name] : [])));
  const ids = (where: 'role' | 'project' | 'section') => new Set(removals.flatMap((r) => (r.kind === 'bullet' && r.in === where ? [r.id] : [])));
  const [role, project, section] = [ids('role'), ids('project'), ids('section')];
  const entries = new Set(removals.flatMap((r) => (r.kind === 'entry' ? [`${r.section}:${r.title}`] : [])));
  return reconcileStructure({
    ...doc,
    skills: skills.size ? doc.skills.filter((s) => !skills.has(s.name)) : doc.skills,
    roles: role.size ? doc.roles.map((r) => ({ ...r, bullets: r.bullets.filter((b) => !role.has(b.id)) })) : doc.roles,
    projects: project.size ? doc.projects.map((p) => ({ ...p, bullets: p.bullets.filter((b) => !project.has(b.id)) })) : doc.projects,
    ...(doc.sections && (section.size || entries.size)
      ? {
          sections: doc.sections.map((s) => ({
            ...s,
            lines: s.lines.filter((l) => !section.has(l.id)),
            entries: s.entries.filter((e) => !entries.has(`${s.id}:${e.title}`)).map((e) => ({ ...e, bullets: e.bullets.filter((b) => !section.has(b.id)) })),
          })),
        }
      : {}),
  });
}

export const withoutBullets = (doc: CanonicalResumeJson, ids: readonly string[]): CanonicalResumeJson =>
  without(doc, ids.map((id) => ({ kind: 'bullet', in: 'role', id })));

/**
 * The removals that cost the score nothing, in their order: each is tried on top of the ones
 * already kept, and stays only when `holds` says the document is worth as much without it. So
 * every prefix of the answer is safe, which is what the fit's search needs.
 */
export function safeRemovals(doc: CanonicalResumeJson, order: readonly Removal[], holds: (after: CanonicalResumeJson) => boolean): Removal[] {
  const kept: Removal[] = [];
  for (const removal of order) {
    checkDeadline();
    if (holds(without(doc, [...kept, removal]))) kept.push(removal);
  }
  return kept;
}

/** How a fit's removals read in a version note: "2 bullets and 3 skills". */
export function removedLabel(removed: readonly Removal[]): string {
  const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const skills = removed.filter((r) => r.kind === 'skill').length;
  const entries = removed.filter((r) => r.kind === 'entry').length;
  const bullets = removed.length - skills - entries;
  const parts = [bullets ? count(bullets, 'bullet') : '', skills ? count(skills, 'skill') : '', entries ? `${entries} extra ${entries === 1 ? 'entry' : 'entries'}` : ''].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? '');
}

export async function fitToPages(args: { doc: CanonicalResumeJson; budget: number; mayTrim: boolean; order: () => readonly Removal[]; measure: Measure; compiled: boolean }): Promise<PageFit> {
  const { doc, budget, compiled } = args;
  const seen = new Map<string, number>();
  const pagesOf = async (removed: readonly Removal[], density: LatexDensity) => {
    const key = `${density}:${removed.map(keyOf).join('|')}`;
    // Each compile can take seconds; a run past its deadline stops between them.
    if (!seen.has(key)) {
      checkDeadline();
      seen.set(key, await args.measure(without(doc, removed), density));
    }
    return seen.get(key)!;
  };
  /** The loosest spacing at which the document fits without these, or null. */
  const loosest = async (removed: readonly Removal[]) => {
    for (const density of DENSITIES) if ((await pagesOf(removed, density)) <= budget) return density;
    return null;
  };
  const fit = async (removed: readonly Removal[], density: LatexDensity): Promise<PageFit> => ({ doc: without(doc, removed), density, pages: await pagesOf(removed, density), dropped: removed.length, removed: [...removed], compiled });

  const asIs = await loosest([]);
  if (asIs !== null) return fit([], asIs);
  if (!args.mayTrim) return fit([], 2);
  const order = args.order();
  if (order.length === 0 || (await pagesOf(order, 2)) > budget) return fit([], 2);
  // The fewest removals, in their order, that fit at the tightest spacing.
  let lo = 1;
  let hi = order.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await pagesOf(order.slice(0, mid), 2)) <= budget) hi = mid;
    else lo = mid + 1;
  }
  // The search takes a prefix, so it may hold skills or section lines whose going freed no line of
  // the page. Each kind is given back whole when the page still fits with it.
  let removed = order.slice(0, lo);
  for (const back of [(r: Removal) => r.kind === 'skill', (r: Removal) => r.kind === 'bullet' && r.in === 'section']) {
    const rest = removed.filter((r) => !back(r));
    if (rest.length < removed.length && (await pagesOf(rest, 2)) <= budget) removed = rest;
  }
  // Then the loosest spacing that holds.
  return fit(removed, (await loosest(removed)) ?? 2);
}
