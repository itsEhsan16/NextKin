import { sectionHeading, type DocLine, type ResumeDocument } from '@nextkin/shared/models';

/**
 * The document as plain text, in print order: what "Copy my edits" puts on the clipboard when a
 * save is refused (EDIT 03), so nothing typed here is lost when the newer copy loads.
 */

const lines = (items: DocLine[]) => items.filter((l) => l.text.trim()).map((l) => `• ${l.text}`);
const span = (start: string | null, end: string | null) =>
  start ? `${start} – ${end ?? 'Present'}` : '';
const join = (...parts: (string | undefined)[]) => parts.filter((p) => p?.trim()).join(' · ');

export function documentText(doc: ResumeDocument): string {
  const out: string[] = [
    doc.header.name,
    doc.header.headline,
    join(...doc.header.items.map((i) => i.text)),
  ];
  for (const key of doc.order) {
    const body: string[] = [];
    if (key === 'summary') body.push(doc.summary);
    else if (key === 'skills')
      body.push(
        ...doc.skills.groups.map((g) => `${g.label}: ${g.skills.join(', ')}`),
        doc.skills.loose.join(', '),
      );
    else if (key === 'experience')
      for (const r of doc.experience)
        body.push(join(r.title, r.company, r.location, span(r.start, r.end)), ...lines(r.bullets));
    else if (key === 'projects')
      for (const p of doc.projects)
        body.push(join(p.name, p.tech, span(p.start, p.end)), p.description, ...lines(p.bullets));
    else if (key === 'education')
      for (const e of doc.education)
        body.push(join(e.degree, e.field, e.institution, span(e.start, e.end)));
    else if (key === 'certifications')
      body.push(...doc.certifications.map((c) => join(c.name, c.issuer)));
    else {
      const section = doc.custom.find((s) => `x:${s.id}` === key);
      for (const e of section?.entries ?? [])
        body.push(join(e.title, e.subtitle, e.right), ...lines(e.bullets));
      body.push(...lines(section?.lines ?? []));
    }
    const kept = body.filter((b) => b.trim());
    if (kept.length) out.push('', sectionHeading(doc, key).toUpperCase(), ...kept);
  }
  return out.filter((l, i) => l.trim() || i > 2).join('\n');
}
