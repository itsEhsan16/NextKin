import type { LineSource, ResumeContent } from '../models/resumeContent';
import type { CanonicalResumeJson } from '../schemas/resumeContent';

/**
 * Where each line of a resume came from (toreview §146.4), read off the claims themselves: a
 * generated line cites the facts it rests on, by id (`engines/facts.ts`), and these turn those ids
 * into words. On a tailored version the facts are the lines of the resume it was made from, so
 * `base` is that version: a citation then gives back the line the AI reworded.
 */

type Citing = { text: string; origin: LineSource['origin']; evidence: readonly string[] };

function sourceOf(claim: Citing, doc: CanonicalResumeJson, base: CanonicalResumeJson | undefined): LineSource {
  const from = base ?? doc;
  const facts = new Set<string>();
  const lines: string[] = [];

  for (const id of claim.evidence) {
    const [fact = '', part = ''] = id.split('#');
    if (fact === 'profile') {
      facts.add(part === 'summary' ? 'Your summary' : 'Your headline');
      if (part === 'summary' && from.summary) lines.push(from.summary.text);
      continue;
    }
    const role = from.roles.find((r) => r.roleId === fact) ?? doc.roles.find((r) => r.roleId === fact);
    if (role) {
      facts.add(`Your ${role.title} role at ${role.company}`);
      const line = /^r(\d+)$/.exec(part);
      const bullet = line ? role.bullets[Number(line[1])] : undefined;
      if (bullet) lines.push(bullet.text);
      continue;
    }
    const project = from.projects.find((p) => p.factId === fact) ?? doc.projects.find((p) => p.factId === fact);
    if (project) {
      facts.add(`Your ${project.name} project`);
      const line = /^p(\d+)$/.exec(part);
      const bullet = line ? project.bullets[Number(line[1])] : undefined;
      if (bullet) lines.push(bullet.text);
      continue;
    }
    const school = from.education.find((e) => e.factId === fact);
    if (school) {
      facts.add(`Your ${school.degree} at ${school.institution}`);
      continue;
    }
    const certificate = from.certifications.find((c) => c.factId === fact);
    if (certificate) facts.add(`Your ${certificate.name} certification`);
  }

  const before = lines.find((line) => line !== claim.text);
  return { text: claim.text, origin: claim.origin, facts: [...facts], ...(before ? { before } : {}) };
}

/** Every line the resume page prints. Not a claim of its own, an entry's name is a plain fact. */
export function lineSourcesOf(doc: CanonicalResumeJson, base?: CanonicalResumeJson): LineSource[] {
  const claim = (c: Citing) => sourceOf(c, doc, base);
  const fact = (text: string, assumed: boolean | undefined, said: string): LineSource => ({
    text,
    origin: assumed ? 'assumed' : 'user',
    facts: [said],
  });

  return [
    ...(doc.summary ? [claim(doc.summary)] : []),
    ...doc.skills.map((skill) => claim({ text: skill.name, origin: skill.origin, evidence: skill.evidence })),
    ...doc.roles.flatMap((role) => [
      fact(role.title, role.assumed, `Your ${role.title} role at ${role.company}`),
      ...role.bullets.map(claim),
    ]),
    ...doc.projects.flatMap((project) => [
      fact(project.name, false, `Your ${project.name} project`),
      ...(project.description ? [fact(project.description, false, `Your ${project.name} project`)] : []),
      ...project.bullets.map(claim),
    ]),
    ...doc.education.map((entry) => fact(entry.degree, entry.assumed, `Your ${entry.degree} at ${entry.institution}`)),
    ...doc.certifications.map((entry) => fact(entry.name, false, `Your ${entry.name} certification`)),
  ];
}

/** The mock's version: its documents carry no claims, so a tailored one is all the AI's. */
export function lineSourcesOfContent(content: ResumeContent, tailored: boolean): LineSource[] {
  const origin = tailored ? ('generated' as const) : ('user' as const);
  return [
    ...(content.summary ? [{ text: content.summary, origin, facts: ['Your summary'] }] : []),
    ...content.skills.map((text) => ({ text, origin: 'user' as const, facts: ['Your skills'] })),
    ...content.experience.flatMap((role) => {
      const facts = [`Your ${role.title} role at ${role.company}`];
      const lineOrigin = role.needsReview ? ('assumed' as const) : origin;
      return [
        { text: role.title, origin: role.needsReview ? ('assumed' as const) : ('user' as const), facts },
        ...role.bullets.map((text) => ({ text, origin: lineOrigin, facts })),
      ];
    }),
    ...content.projects.flatMap((project) => {
      const facts = [`Your ${project.name} project`];
      return [project.name, project.description, ...project.bullets]
        .filter(Boolean)
        .map((text) => ({ text, origin: 'user' as const, facts }));
    }),
    ...content.education.map((entry) => ({
      text: entry.degree,
      origin: entry.needsReview ? ('assumed' as const) : ('user' as const),
      facts: [`Your ${entry.degree} at ${entry.institution}`],
    })),
    ...content.certifications.map((text) => ({
      text,
      origin: 'user' as const,
      facts: [`Your ${text} certification`],
    })),
  ];
}
