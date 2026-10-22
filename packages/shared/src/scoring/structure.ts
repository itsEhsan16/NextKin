import type { CanonicalResumeJson } from '../schemas/resumeContent';

/**
 * The page structure a resume keeps from its file (toreview §111): client projects that name a
 * role's bullets, skill lines that name skills, extra sections, the section order. Writers change
 * the lines; this keeps the structure pointing only at what is still there, so an edit, a merge or
 * a regeneration can never leave a group naming a bullet that is gone, or lose a section.
 */

/** The six standard sections, in the order a document without its own layout prints them. */
export const STANDARD_ORDER = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'] as const;

const lower = (s: string) => s.trim().toLowerCase();

export function reconcileStructure(doc: CanonicalResumeJson): CanonicalResumeJson {
  const roles = doc.roles.map((role) => {
    if (!role.entries) return role;
    const ids = new Set(role.bullets.map((b) => b.id));
    const entries = role.entries.map((e) => ({ ...e, bulletIds: e.bulletIds.filter((id) => ids.has(id)) })).filter((e) => e.bulletIds.length > 0);
    const { entries: _drop, ...rest } = role;
    return entries.length ? { ...rest, entries } : rest;
  });

  let skillGroups = doc.skillGroups;
  if (skillGroups) {
    const names = new Map(doc.skills.map((s) => [lower(s.name), s.name]));
    skillGroups = skillGroups
      .map((g) => ({ ...g, names: [...new Set(g.names.map((n) => names.get(lower(n))).filter((n): n is string => Boolean(n)))] }))
      .filter((g) => g.names.length > 0);
  }

  let layout = doc.layout;
  if (layout) {
    const sectionIds = new Set((doc.sections ?? []).map((s) => `x:${s.id}`));
    const known = (key: string) => (STANDARD_ORDER as readonly string[]).includes(key) || sectionIds.has(key);
    const order = [...new Set(layout.order.filter(known))];
    // A section the file did not have, added later, goes where the standard order puts it.
    for (const key of [...STANDARD_ORDER, ...sectionIds]) if (!order.includes(key)) order.push(key);
    layout = { order, headings: Object.fromEntries(Object.entries(layout.headings).filter(([k]) => known(k))) };
  }

  const { skillGroups: _g, layout: _l, ...rest } = doc;
  return {
    ...rest,
    roles,
    ...(skillGroups && skillGroups.length ? { skillGroups } : {}),
    ...(layout ? { layout } : {}),
  };
}

/** The groups of a role's bullets as the page prints them: ungrouped first, then each entry. */
export function bulletGroups(role: CanonicalResumeJson['roles'][number]): { title?: string; tech?: string; bullets: CanonicalResumeJson['roles'][number]['bullets'] }[] {
  const byId = new Map(role.bullets.map((b) => [b.id, b]));
  const grouped = new Set((role.entries ?? []).flatMap((e) => e.bulletIds));
  const loose = role.bullets.filter((b) => !grouped.has(b.id));
  return [
    ...(loose.length ? [{ bullets: loose }] : []),
    ...(role.entries ?? []).map((e) => ({ title: e.title, ...(e.tech ? { tech: e.tech } : {}), bullets: e.bulletIds.map((id) => byId.get(id)!).filter(Boolean) })),
  ];
}
