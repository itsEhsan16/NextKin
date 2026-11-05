import { MARKETS, type MarketProfile } from '@nextkin/engines/markets';
import { bulletGroups, STANDARD_ORDER } from '@nextkin/shared/scoring/structure';
import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import { marketPeriod, type Identity } from '../model';
import type { LatexContactItem, LatexDensity, LatexEntry, LatexResume, LatexSection } from './types';

/**
 * A stored resume as the LaTeX template sets it (toreview §111): the resume's own header when its
 * file had one, else the account's name and contact; its sections in its own order with its own
 * headings; a role's client projects nested under it; the skills as the file's labelled lines.
 * Only text the document holds is printed: nothing is added here.
 */

const HEADINGS: Record<(typeof STANDARD_ORDER)[number], string> = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Work Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
};

const contactOf = (who: Identity): LatexContactItem[] => [
  ...(who.location ? [{ text: who.location }] : []),
  ...(who.phone ? [{ text: who.phone, url: `tel:${who.phone.replace(/[^\d+]/g, '')}` }] : []),
  ...(who.email ? [{ text: who.email, url: `mailto:${who.email}` }] : []),
];

function skillsSection(doc: CanonicalResumeJson, heading: string): LatexSection | null {
  if (doc.skills.length === 0) return null;
  if (!doc.skillGroups?.length) return { kind: 'lines', heading, lines: [{ text: doc.skills.map((s) => s.name).join(', ') }] };
  const grouped = new Set(doc.skillGroups.flatMap((g) => g.names.map((n) => n.toLowerCase())));
  const rest = doc.skills.map((s) => s.name).filter((n) => !grouped.has(n.toLowerCase()));
  // Skills on no line join the file's own "Also" line when it has one, never a second (toreview §170).
  const also = doc.skillGroups.findIndex((g) => /^\s*also\s*$/i.test(g.label));
  const lines = doc.skillGroups.map((g, i) => ({ label: g.label, text: [...g.names, ...(i === also ? rest : [])].join(', ') }));
  return { kind: 'lines', heading, lines: [...lines, ...(rest.length && also < 0 ? [{ label: 'Also', text: rest.join(', ') }] : [])] };
}

function experienceSection(doc: CanonicalResumeJson, heading: string, market: MarketProfile): LatexSection | null {
  if (doc.roles.length === 0) return null;
  const entries = doc.roles.map((role): LatexEntry => {
    const groups = bulletGroups(role);
    const loose = groups.find((g) => !g.title);
    return {
      title: role.company,
      right: marketPeriod(role.start, role.end, market),
      subtitle: role.title,
      subtitleBold: true,
      ...(role.location ? { subRight: role.location } : {}),
      bullets: (loose?.bullets ?? []).map((b) => b.text),
      children: groups.filter((g) => g.title).map((g) => ({ title: g.title!, ...(g.tech ? { tech: g.tech, techInline: true } : {}), bullets: g.bullets.map((b) => b.text) })),
    };
  });
  return { kind: 'entries', heading, entries };
}

function sectionOf(doc: CanonicalResumeJson, key: string, market: MarketProfile): LatexSection | null {
  const heading = doc.layout?.headings[key] ?? (HEADINGS as Record<string, string>)[key] ?? key;
  switch (key) {
    case 'summary':
      return doc.summary ? { kind: 'paragraph', heading, text: doc.summary.text } : null;
    case 'skills':
      return skillsSection(doc, heading);
    case 'experience':
      return experienceSection(doc, heading, market);
    case 'projects':
      return doc.projects.length
        ? {
            kind: 'entries',
            heading,
            entries: doc.projects.map((p) => ({
              title: p.name,
              ...(p.tech ? { tech: p.tech, techInline: true } : {}),
              ...(p.start || p.end ? { right: marketPeriod(p.start, p.end, market) } : {}),
              ...(p.description ? { subtitle: p.description } : {}),
              bullets: p.bullets.map((b) => b.text),
            })),
          }
        : null;
    case 'education':
      return doc.education.length
        ? {
            kind: 'entries',
            heading,
            entries: doc.education.map((e) => ({
              title: e.institution,
              ...(e.start || e.end ? { right: marketPeriod(e.start, e.end, market) } : {}),
              subtitle: [[e.degree, e.field].filter(Boolean).join(', '), e.gpa].filter(Boolean).join(', '),
              ...(e.location ? { subRight: e.location } : {}),
              bullets: [],
            })),
          }
        : null;
    case 'certifications':
      return doc.certifications.length ? { kind: 'lines', heading, lines: doc.certifications.map((c) => ({ text: c.issuer ? `${c.name}, ${c.issuer}` : c.name })) } : null;
    default: {
      const extra = doc.sections?.find((s) => `x:${s.id}` === key);
      if (!extra) return null;
      if (extra.entries.length === 0) return extra.lines.length ? { kind: 'lines', heading: extra.heading, lines: extra.lines.map((l) => ({ text: l.text })) } : null;
      return {
        kind: 'entries',
        heading: extra.heading,
        entries: [
          ...extra.entries.map((e) => ({ title: e.title, ...(e.right ? { right: e.right } : {}), ...(e.subtitle ? { subtitle: e.subtitle } : {}), ...(e.subRight ? { subRight: e.subRight } : {}), bullets: e.bullets.map((b) => b.text) })),
          ...extra.lines.map((l) => ({ title: l.text, bullets: [] })),
        ],
      };
    }
  }
}

export function latexResumeOf(doc: CanonicalResumeJson, who: Identity, options: { density?: LatexDensity; paper?: LatexResume['paper']; market?: MarketProfile } = {}): LatexResume {
  const market = options.market ?? MARKETS.profiles.us;
  const order = doc.layout?.order ?? [...STANDARD_ORDER, ...(doc.sections ?? []).map((s) => `x:${s.id}`)];
  return {
    name: doc.header?.name ?? who.name,
    ...(doc.headline ? { headline: doc.headline } : {}),
    contact: doc.header?.items ?? contactOf(who),
    sections: order.map((key) => sectionOf(doc, key, market)).filter((s): s is LatexSection => s !== null),
    density: options.density ?? 0,
    paper: options.paper ?? 'letter',
  };
}
