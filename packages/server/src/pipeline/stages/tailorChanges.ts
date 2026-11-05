import type { TailorChange } from '@nextkin/shared/models/tailor';
import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { leftOutChecker } from '@nextkin/engines/leftOut';

import type { ReviewRecord } from './reviewEdits';
import { skillKey, type TailorRunInput } from './tailorMerge';

const joinAnd = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** "Excel, Word and 3 more": a long list named by its first few. */
const named = (items: readonly string[], shown = 3) =>
  items.length <= shown + 1 ? joinAnd(items) : `${items.slice(0, shown).join(', ')} and ${items.length - shown} more`;

/**
 * "What changed for this job" (734:2033), read off the two versions: only what the run did, then
 * what was left out and why. Nothing here says a change happened that the document does not show.
 */
export function changesOf(args: { base: CanonicalResumeJson; final: CanonicalResumeJson; request: TailorRunInput; stripped: number; pages: number; review?: ReviewRecord }): TailorChange[] {
  const { base, final, request } = args;
  const out: TailorChange[] = [];
  const did = (label: string) => out.push({ label, left: false });
  if (final.headline && final.headline !== base.headline) did(`Headline aimed at ${final.headline}`);
  if (final.summary && final.summary.text !== base.summary?.text) did('Summary rewritten for this role');

  const had = new Set(base.skills.map((s) => skillKey(s.name)));
  const added = final.skills.filter((s) => !had.has(skillKey(s.name))).map((s) => s.name);
  if (added.length) did(`Added ${named(added)}, as you chose`);
  const order = (doc: CanonicalResumeJson) => doc.skills.filter((s) => had.has(skillKey(s.name))).map((s) => skillKey(s.name));
  if (order(final).join('|') !== order(base).join('|')) did('The skills this job asks for listed first');

  // Where the AI put each ticked keyword (toreview §116): named, so the user can check each one.
  const ticked = leftOutChecker(TAXONOMY, request.added);
  const placements = [
    ...final.roles.map((r) => ({ where: `${r.title} · ${r.company}`, now: ticked(r.bullets.map((b) => b.text).join('\n')), was: ticked((base.roles.find((x) => x.roleId === r.roleId)?.bullets ?? []).map((b) => b.text).join('\n')) })),
    ...final.projects.map((p) => ({ where: p.name, now: ticked(p.bullets.map((b) => b.text).join('\n')), was: ticked((base.projects.find((x) => x.factId === p.factId)?.bullets ?? []).map((b) => b.text).join('\n')) })),
  ];
  for (const { where, now, was } of placements) {
    const fresh = now.filter((k) => !was.includes(k));
    if (fresh.length) did(`Put ${named(fresh)} into ${where} — check it’s where you used it`);
  }
  for (const project of final.projects) {
    const before = base.projects.find((p) => p.factId === project.factId);
    if (before && project.bullets.some((b) => !before.bullets.some((x) => x.text === b.text))) did(`Rewrote the bullets in ${project.name}`);
  }
  for (const role of final.roles) {
    const before = base.roles.find((r) => r.roleId === role.roleId);
    if (!before) continue;
    const where = `${role.title} · ${role.company}`;
    const was = new Set(before.bullets.map((b) => b.text));
    const counts = role.bullets.length === before.bullets.length ? '' : ` (${before.bullets.length} → ${role.bullets.length})`;
    if (role.bullets.some((b) => !was.has(b.text))) did(`Rewrote the bullets in ${where}${counts}`);
    else if (role.bullets.length < before.bullets.length) did(`Kept ${role.bullets.length} of ${before.bullets.length} bullets in ${where}`);
  }
  out.push(...reviewChanges(args.base, args.final, args.review));
  const plural = (n: number) => `${n} page${n === 1 ? '' : 's'}`;
  if (request.sourcePages != null && args.pages < request.sourcePages) did(`${request.sourceMeasured ? '' : 'About '}${plural(request.sourcePages)} → ${plural(args.pages)}`);

  const listed = new Set(final.skills.map((s) => skillKey(s.name)));
  const skipped = request.skipped.filter((s) => !listed.has(skillKey(s)));
  if (skipped.length) out.push({ label: `${named(skipped)} left out, as you chose`, left: true });
  if (args.stripped > 0) out.push({ label: `Left out ${args.stripped} ${args.stripped === 1 ? 'line' : 'lines'} your resume doesn’t back`, left: true });
  return out;
}

/**
 * What the AI's review did (toreview §170), each line naming what moved or went so the user can
 * check it; a header statement it doubted is a note, never a change. Rewrites of the summary and
 * bullets are already named above, read off the two versions.
 */
function reviewChanges(base: CanonicalResumeJson, final: CanonicalResumeJson, review: ReviewRecord | undefined): TailorChange[] {
  if (!review) return [];
  const out: TailorChange[] = [];
  const applied = (op: ReviewRecord['applied'][number]['op']) => review.applied.filter((a) => a.op === op);
  const moved = applied('move_skill').map((a) => `${a.target} to ${a.text}`);
  if (moved.length) out.push({ label: `Moved ${named(moved, 2)}`, left: false });
  const dropped = applied('drop_skill');
  if (dropped.length) out.push({ label: `Took ${named(dropped.map((a) => a.target ?? ''))} off the skills list — ${dropped.length === 1 ? 'a duplicate or a phrase from the job, not a skill' : 'duplicates or phrases from the job, not skills'}`, left: false });
  const renamed = applied('rename_line').map((a) => `${a.target} → ${a.text}`);
  if (renamed.length) out.push({ label: `Renamed ${named(renamed, 2)}`, left: false });
  const order = (doc: CanonicalResumeJson) => (doc.layout?.order ?? []).join('|');
  if (applied('order_sections').length && order(base) !== order(final)) out.push({ label: 'Sections ordered for this job', left: false });
  if (applied('order_projects').length) out.push({ label: 'Projects ordered by what this job asks for', left: false });
  if (applied('order_bullets').length) out.push({ label: 'The strongest lines for this job moved up', left: false });
  for (const flag of review.headerFlags) out.push({ label: `Your header says “${flag.text}”: ${flag.reason}`, left: true });
  return out;
}
