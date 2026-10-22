import { parsePartialDate } from '@nextkin/engines/dates';
import { MARKETS, type MarketProfile } from '@nextkin/engines/markets';
import type { CanonicalLetterJson, CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

/**
 * The one model every renderer reads (ImBackendImplementationPlan P10-04/05; V2 §7.12: "all exports
 * render from the single canonical structured resume model, so the preview, the PDF and the DOCX
 * always agree"). PDF, DOCX and TXT all walk these sections in this order, and parse-back (P10-06)
 * checks each file against the same list of lines.
 *
 * Headings are the conventional ones §7.12 names, dates follow the target market (Q-07), and
 * nothing here is a table, an image or a column.
 */

export type RenderBlock =
  | { kind: 'paragraph'; text: string }
  /** `title` bold (the employer, school or project), `subtitle` bold too (a job title), `meta` plain. */
  | { kind: 'entry'; title: string; subtitle?: string; meta?: string; bullets: string[] };

export interface RenderSection {
  heading: string;
  blocks: RenderBlock[];
}

export interface RenderModel {
  kind: 'resume' | 'cover_letter';
  name: string;
  headline?: string;
  contact: string[];
  sections: RenderSection[];
  /** The page the file is set on (toreview §130): Letter in the US and Canada, A4 elsewhere. */
  paper?: 'letter' | 'a4';
}

export interface Identity {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mar 2022" or "03/2022", by the market's convention; a year alone stays a year. */
export function marketDate(value: string | null | undefined, market: MarketProfile): string {
  const d = value ? parsePartialDate(value) : null;
  if (!d) return '';
  if (!d.month) return String(d.year);
  return market.dateFormat === 'MM/YYYY' ? `${String(d.month).padStart(2, '0')}/${d.year}` : `${MONTHS[d.month - 1]} ${d.year}`;
}

export function marketPeriod(start: string | null | undefined, end: string | null | undefined, market: MarketProfile): string {
  const from = marketDate(start, market);
  const to = end === null ? 'Present' : marketDate(end, market);
  return [from, to].filter(Boolean).join(' – ');
}

/** One plain separator in every file (toreview §130). */
export const SEPARATOR = ' | ';

const joinMeta = (...parts: (string | undefined)[]) => parts.filter((p): p is string => !!p && p.trim().length > 0).join(SEPARATOR);

export function resumeModel(doc: CanonicalResumeJson, who: Identity, market: MarketProfile = MARKETS.profiles.us): RenderModel {
  const sections: RenderSection[] = [];
  if (doc.summary) sections.push({ heading: 'Summary', blocks: [{ kind: 'paragraph', text: doc.summary.text }] });
  if (doc.skills.length) sections.push({ heading: 'Skills', blocks: [{ kind: 'paragraph', text: doc.skills.map((s) => s.name).join(', ') }] });
  if (doc.roles.length) {
    sections.push({
      heading: 'Experience',
      // As the PDF sets it: the employer, then the job title, both bold (toreview §130).
      blocks: doc.roles.map((r) => ({ kind: 'entry', title: r.company, subtitle: r.title, meta: joinMeta(r.location, marketPeriod(r.start, r.end, market)), bullets: r.bullets.map((b) => b.text) })),
    });
  }
  if (doc.projects.length) {
    sections.push({ heading: 'Projects', blocks: doc.projects.map((p) => ({ kind: 'entry', title: p.name, ...(p.description ? { meta: p.description } : {}), bullets: p.bullets.map((b) => b.text) })) });
  }
  if (doc.certifications.length) {
    sections.push({ heading: 'Certifications', blocks: doc.certifications.map((c) => ({ kind: 'paragraph', text: c.issuer ? `${c.name}, ${c.issuer}` : c.name })) });
  }
  if (doc.education.length) {
    sections.push({
      heading: 'Education',
      blocks: doc.education.map((e) => ({ kind: 'entry', title: e.institution, meta: joinMeta([e.degree, e.field].filter(Boolean).join(', '), marketPeriod(e.start ?? null, e.end ?? null, market)), bullets: [] })),
    });
  }
  return { kind: 'resume', name: who.name, ...(doc.headline ? { headline: doc.headline } : {}), contact: [who.email, who.phone, who.location].filter((v): v is string => !!v), sections };
}

export function letterModel(letter: CanonicalLetterJson, who: Identity): RenderModel {
  const blocks: RenderBlock[] = [
    ...(letter.greeting ? [{ kind: 'paragraph' as const, text: letter.greeting }] : []),
    ...letter.paragraphs.map((p) => ({ kind: 'paragraph' as const, text: p.text })),
    ...(letter.signoff ? [{ kind: 'paragraph' as const, text: letter.signoff }, { kind: 'paragraph' as const, text: who.name }] : []),
  ];
  return { kind: 'cover_letter', name: who.name, contact: [who.email, who.phone, who.location].filter((v): v is string => !!v), sections: [{ heading: '', blocks }] };
}

/** Every line a reader must find, in reading order: what parse-back compares a file against. */
export function expectedLines(model: RenderModel): string[] {
  const lines = [model.name, ...(model.headline ? [model.headline] : []), ...(model.contact.length ? [model.contact.join(SEPARATOR)] : [])];
  for (const section of model.sections) {
    if (section.heading) lines.push(section.heading);
    for (const block of section.blocks) {
      if (block.kind === 'paragraph') lines.push(block.text);
      else lines.push(block.title, ...(block.subtitle ? [block.subtitle] : []), ...(block.meta ? [block.meta] : []), ...block.bullets);
    }
  }
  return lines;
}

/** V2 §7.12's file name: FirstName_LastName_JobTitle.ext, with anything unsafe collapsed away. */
export function exportFileName(name: string, target: string, format: string): string {
  const safe = (v: string) =>
    v
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');
  return `${[safe(name), safe(target)].filter(Boolean).join('_') || 'Resume'}.${format}`;
}
