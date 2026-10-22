import { MARKETS, marketForLocation } from '@nextkin/engines/markets';
import { toResumeContent } from '@nextkin/shared/scoring/canonical';
import { estimatePages } from '@nextkin/shared/scoring/pages';
import { reconcileStructure } from '@nextkin/shared/scoring/structure';
import type { CanonicalResumeJson, CanonicalRoleJson } from '@nextkin/shared/schemas/resumeContent';

import type { LatexCompiler } from '../../export/latex/compile';
import type { LatexDensity } from '../../export/latex/types';
import type { Identity as Who } from '../../export/model';
import { sourceOf } from '../../services/renders';

/**
 * Fitting a tailored resume to its page budget (toreview §111.6), on the pages the download will
 * have: the merged document is typeset by the sealed compiler, as the render will typeset it.
 * Spacing is tightened first (densities 0–2). Only when that is not enough, and trimming is allowed,
 * whole bullets are dropped, never rewritten: the ones that name none of the job's skills first,
 * from the oldest roles, last line first, keeping three on a recent role and one on any other. If
 * no amount of trimming fits, nothing is dropped: losing lines without reaching the goal helps no one.
 * Without a compiler the page count is the estimate, and only the length fix trims (as before).
 */

export type Measure = (doc: CanonicalResumeJson, density: LatexDensity) => Promise<number>;

export interface PageFit {
  doc: CanonicalResumeJson;
  density: LatexDensity;
  pages: number;
  dropped: number;
  /** Whether `pages` came from a compile, or is the estimate. */
  compiled: boolean;
}

const RECENT_FLOOR = 3;
const DENSITIES: LatexDensity[] = [0, 1, 2];

/** Stands in for the name and contact while measuring (G5: the run has none); one line, as theirs. */
const PLACEHOLDER: Who = { name: 'Your Name', email: 'name@example.com', phone: '+1 555 010 0100', location: 'City, Country' };

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

/**
 * The bullets that may go, in the order they go: fewest job skills named, then the oldest role,
 * then the role's last line. Each role keeps its floor, so the order never empties a role.
 */
export function dropOrder(doc: CanonicalResumeJson, recent: ReadonlySet<string>, jobSkills: readonly string[]): string[] {
  const byAge = [...doc.roles].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const age = new Map(byAge.map((r, i) => [r.roleId, i]));
  const floor = (r: CanonicalRoleJson) => (recent.has(r.roleId) ? RECENT_FLOOR : 1);
  return doc.roles
    .flatMap((role) =>
      role.bullets
        .map((b, at) => ({ id: b.id, hits: mentions(b.text, jobSkills), at, age: age.get(role.roleId) ?? 0 }))
        .sort((x, y) => x.hits - y.hits || y.at - x.at)
        .slice(0, Math.max(0, role.bullets.length - floor(role))),
    )
    .sort((x, y) => x.hits - y.hits || x.age - y.age || y.at - x.at)
    .map((b) => b.id);
}

export function withoutBullets(doc: CanonicalResumeJson, ids: readonly string[]): CanonicalResumeJson {
  if (ids.length === 0) return doc;
  const gone = new Set(ids);
  return reconcileStructure({ ...doc, roles: doc.roles.map((r) => ({ ...r, bullets: r.bullets.filter((b) => !gone.has(b.id)) })) });
}

export async function fitToPages(args: { doc: CanonicalResumeJson; budget: number; mayTrim: boolean; order: readonly string[]; measure: Measure; compiled: boolean }): Promise<PageFit> {
  const { doc, budget, order, compiled } = args;
  const at = (k: number) => (k === 0 ? doc : withoutBullets(doc, order.slice(0, k)));
  const seen = new Map<string, number>();
  const pagesOf = async (k: number, density: LatexDensity) => {
    const key = `${k}:${density}`;
    if (!seen.has(key)) seen.set(key, await args.measure(at(k), density));
    return seen.get(key)!;
  };
  /** The loosest spacing at which `k` dropped bullets fit, or null. */
  const loosest = async (k: number) => {
    for (const density of DENSITIES) if ((await pagesOf(k, density)) <= budget) return density;
    return null;
  };
  const fit = async (k: number, density: LatexDensity): Promise<PageFit> => ({ doc: at(k), density, pages: await pagesOf(k, density), dropped: k, compiled });

  const asIs = await loosest(0);
  if (asIs !== null) return fit(0, asIs);
  if (!args.mayTrim || order.length === 0 || (await pagesOf(order.length, 2)) > budget) return fit(0, 2);
  // The fewest bullets dropped that fit at the tightest spacing; then the loosest spacing that holds.
  let lo = 1;
  let hi = order.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await pagesOf(mid, 2)) <= budget) hi = mid;
    else lo = mid + 1;
  }
  return fit(lo, (await loosest(lo)) ?? 2);
}
