import { mentionsIn, resolveSkill, type Taxonomy } from './normalizer';
import { numbersIn, sameNumber } from './numbers';

/**
 * A tailored project's rewritten bullets, checked against that project's own lines (toreview §113).
 * The claim ledger reads roles; a project has no dates to judge an era by, so its rule is narrower:
 * every bullet cites lines of its own project, states only numbers those lines state, names only
 * technologies the project already names (its lines, its stack, a keyword the user said they used
 * there), and never a keyword the user left out. Pure: the caller decides what a failure costs.
 */

export interface ProjectFacts {
  id: string;
  name: string;
  /** The project's lines as the base resume has them, cited as `${id}#p${i}`. */
  lines: readonly string[];
  /** Its stack line's skills, and keywords confirmed at it. */
  skills: readonly string[];
}

export type ProjectIssue = 'no_evidence' | 'cites_other' | 'number_not_backed' | 'technology_not_backed' | 'not_requested';

export const projectLineId = (projectId: string, i: number) => `${projectId}#p${i}`;

export function checkProjectBullets(
  project: ProjectFacts,
  bullets: readonly { text: string; evidence: readonly string[] }[],
  taxonomy: Taxonomy,
  leftOut: (text: string) => string[] = () => [],
): { index: number; code: ProjectIssue }[] {
  const lineOf = new Map(project.lines.map((text, i) => [projectLineId(project.id, i), text]));
  const allText = [project.name, ...project.lines].join('\n');
  const known = new Set([
    ...mentionsIn(taxonomy, allText).map((m) => m.skillId),
    ...project.skills.map((s) => resolveSkill(taxonomy, s).id),
  ]);
  const issues: { index: number; code: ProjectIssue }[] = [];
  bullets.forEach((bullet, index) => {
    if (bullet.evidence.length === 0) return issues.push({ index, code: 'no_evidence' });
    const cited = bullet.evidence.map((id) => (id === project.id ? allText : lineOf.get(id)));
    if (cited.some((text) => text === undefined)) return issues.push({ index, code: 'cites_other' });
    const source = cited.join('\n');
    const stated = numbersIn(source, taxonomy).map((n) => n.value);
    if (numbersIn(bullet.text, taxonomy).some((n) => !stated.some((v) => sameNumber(v, n.value)))) return issues.push({ index, code: 'number_not_backed' });
    if (mentionsIn(taxonomy, bullet.text).some((m) => !known.has(m.skillId))) return issues.push({ index, code: 'technology_not_backed' });
    if (leftOut(bullet.text).length > 0) return issues.push({ index, code: 'not_requested' });
    return undefined;
  });
  return issues;
}
