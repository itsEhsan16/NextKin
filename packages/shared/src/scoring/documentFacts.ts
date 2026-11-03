import { parsePartialDate, type PartialDate } from '@nextkin/engines/dates';
import type { ProfileFacts } from '@nextkin/engines/facts';

import type { CanonicalResumeJson } from '../schemas/resumeContent';

/**
 * A resume read as the facts a tailored version may cite (toreview §110.3). The owner asked that a
 * tailored resume be built from the resume the user picked, so its own lines are the facts: each
 * role keeps its id, dates and skills, each bullet becomes a citable `${roleId}#r${i}` fact, the
 * summary is `profile#summary`. The skills the user ticked as true are added to the listed skills
 * — nothing else is — so a claim the tailored version makes traces to that resume or to them (G13).
 *
 * A role with no start date is kept with the fallback year the profile loader uses; the tailor
 * stage carries such a role over verbatim rather than let a rewrite date it.
 */

const UNDATED: PartialDate = { year: 1970 };
const date = (value: string | null | undefined): PartialDate | null =>
  value ? parsePartialDate(value) : null;

/** A confirmed keyword as the fact it becomes: "Used KYC: built the onboarding checks". */
export const confirmedLine = (c: { keyword: string; note?: string }) => `Used ${c.keyword}${c.note?.trim() ? `: ${c.note.trim()}` : ''}`;

/**
 * `confirmed` (toreview §112): a ticked keyword the user says they used at a role or project.
 * It joins that role's skills and becomes one more citable line of it, so a bullet there may name it.
 * One the AI placed (`by: 'ai'`, owner, toreview §162) only joins the skills: a bullet there may
 * name it where its own line describes that work, but it adds no line, so it never adds a bullet.
 */
export function factsOfDocument(
  doc: CanonicalResumeJson,
  options: {
    added?: readonly string[];
    redact?: (text: string) => string;
    confirmed?: readonly { keyword: string; where: string; note?: string; by?: 'ai' | 'you' }[];
    /**
     * Ticked keywords the AI places (toreview §116, owner): each dated role and project may carry
     * them, so the plan offers them wherever their era allows; the merge keeps one only where a
     * rewritten line says it, and the ready screen names every place it went.
     */
    placeable?: readonly string[];
  } = {},
): ProfileFacts {
  const placeable = options.placeable ?? [];
  const at = (where: string) => (options.confirmed ?? []).filter((c) => c.where === where);
  // The user's own word is a citable line; the AI's pick is not.
  const said = (where: string) => at(where).filter((c) => c.by !== 'ai');
  // Free text is what a model reads, so the caller's redaction (contact details) runs on it.
  const clean = options.redact ?? ((text: string) => text);
  const skills = [
    ...new Set(
      [...doc.skills.map((s) => s.name), ...(options.added ?? [])]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  return {
    ...(doc.headline ? { headline: doc.headline } : {}),
    ...(doc.summary ? { summary: clean(doc.summary.text) } : {}),
    skills,
    roles: doc.roles.map((role) => ({
      id: role.roleId,
      company: role.company,
      title: role.title,
      start: date(role.start) ?? UNDATED,
      end: role.end === null ? null : date(role.end),
      ...(role.location ? { location: role.location } : {}),
      responsibilities: [...role.bullets.map((b) => clean(b.text)), ...said(role.roleId).map((c) => clean(confirmedLine(c)))],
      skills: [...new Set([...role.skills, ...at(role.roleId).map((c) => c.keyword), ...(role.start ? placeable : [])])],
    })),
    education: doc.education.map((e) => ({
      id: e.factId,
      institution: e.institution,
      degree: e.degree,
      ...(e.field ? { field: e.field } : {}),
      start: date(e.start),
      end: e.end === null ? null : (date(e.end) ?? undefined),
    })),
    certifications: doc.certifications.map((c) => ({
      id: c.factId,
      name: c.name,
      issuer: c.issuer ?? '',
    })),
    projects: doc.projects.map((p) => {
      const description = [p.description ?? '', ...p.bullets.map((b) => b.text), ...said(`project:${p.factId}`).map(confirmedLine)]
        .filter(Boolean)
        .join('\n');
      const confirmedHere = at(`project:${p.factId}`);
      const stack = (p.tech ?? '').split(/\s*[,|/]\s*/).map((s) => s.trim()).filter(Boolean);
      return {
        id: p.factId,
        name: p.name,
        ...(description ? { description: clean(description) } : {}),
        // Its lines, citable one by one, so a tailored run may reword them (toreview §113).
        lines: [...p.bullets.map((b) => clean(b.text)), ...said(`project:${p.factId}`).map((c) => clean(confirmedLine(c)))],
        skills: [...new Set([...stack, ...confirmedHere.map((c) => c.keyword), ...placeable])],
      };
    }),
  };
}

/**
 * The base resume with the user's rewritten bullets in place (toreview §129). Each replaces the
 * line it names, as the user's own words; one naming a role or line that isn't there is dropped.
 * The run's facts and its merge both read the base through this, so they agree.
 */
export function withFigures(doc: CanonicalResumeJson, figures: readonly { where: string; line: number; text: string }[] = []): CanonicalResumeJson {
  if (figures.length === 0) return doc;
  return {
    ...doc,
    roles: doc.roles.map((role) => {
      const mine = figures.filter((f) => f.where === role.roleId && f.line < role.bullets.length && f.text.trim());
      if (mine.length === 0) return role;
      return {
        ...role,
        bullets: role.bullets.map((b, i) => {
          const figure = mine.find((f) => f.line === i);
          return figure ? { ...b, text: figure.text.trim(), origin: 'user' as const, evidence: [] } : b;
        }),
      };
    }),
  };
}

/**
 * The resume as the user's answers leave it, before the AI writes anything: ticked keywords in
 * the skills, confirmed ones on their role. What a run's projection scores (toreview §129).
 */
export function withChoices(doc: CanonicalResumeJson, choices: { added: readonly string[]; confirmed?: readonly { keyword: string; where: string }[] }): CanonicalResumeJson {
  const have = new Set(doc.skills.map((s) => s.name.toLowerCase()));
  const ticks = choices.added.filter((k) => !have.has(k.toLowerCase()));
  return {
    ...doc,
    skills: [...doc.skills, ...ticks.map((name, i) => ({ id: `tick-${i}`, name, evidence: [] as string[], origin: 'user' as const }))],
    roles: doc.roles.map((role) => {
      const here = (choices.confirmed ?? []).filter((c) => c.where === role.roleId).map((c) => c.keyword);
      return here.length ? { ...role, skills: [...new Set([...role.skills, ...here])] } : role;
    }),
  };
}

/** Every line of a resume as one text: what a soft-skill check reads (toreview §113). */
export const documentText = (doc: CanonicalResumeJson): string =>
  [
    doc.headline ?? '',
    doc.summary?.text ?? '',
    ...doc.skills.map((s) => s.name),
    ...doc.roles.flatMap((r) => [r.title, ...r.bullets.map((b) => b.text)]),
    ...doc.projects.flatMap((p) => [p.name, p.description ?? '', ...p.bullets.map((b) => b.text)]),
  ].join('\n');

/** Where a ticked keyword may be said to have been used (toreview §112): roles, then projects. */
export const placesOf = (doc: CanonicalResumeJson): { id: string; label: string }[] => [
  ...doc.roles.map((r) => ({ id: r.roleId, label: `${r.title} · ${r.company}` })),
  ...doc.projects.map((p) => ({ id: `project:${p.factId}`, label: p.name })),
];

/** The same places from a resume as the apps hold it (the mock's comparisons). */
export const placesOfContent = (body: { experience: readonly { id: string; roleId?: string; title: string; company: string }[]; projects: readonly { id: string; name: string }[] }): { id: string; label: string }[] => [
  ...body.experience.map((r) => ({ id: r.roleId ?? r.id, label: `${r.title} · ${r.company}` })),
  ...body.projects.map((p) => ({ id: `project:${p.id}`, label: p.name })),
];

/** Roles a rewrite may not touch: no start date to judge its technologies against (§7.7). */
export const undatedRoleIds = (doc: CanonicalResumeJson): Set<string> =>
  new Set(doc.roles.filter((r) => !r.start).map((r) => r.roleId));
