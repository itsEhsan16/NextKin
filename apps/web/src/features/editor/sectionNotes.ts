import type { DocSectionKey, ResumeDocument } from '@nextkin/shared/models';

/**
 * The count beside each section's heading in the editor (EDIT 01, 866:222): "3 roles",
 * "12 skills", and for the header the name, the place and how many contact lines it prints.
 * An empty section says so, because an empty section is left off the page.
 */

const count = (n: number, one: string, many = `${one}s`) =>
  n === 0 ? 'Empty — left off the page' : `${n} ${n === 1 ? one : many}`;

const looksLikeContact = (text: string) => /@|\d{3}|\.[a-z]{2,}|^https?:/i.test(text);

export function headerNote(doc: ResumeDocument): string {
  const { name, items } = doc.header;
  const place = items.find((i) => i.text.trim() && !looksLikeContact(i.text))?.text.split(',')[0];
  return [
    name.trim(),
    place?.trim(),
    items.length ? `${items.length} contact ${items.length === 1 ? 'line' : 'lines'}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function sectionNote(doc: ResumeDocument, key: DocSectionKey): string {
  switch (key) {
    case 'summary': {
      const lines = doc.summary.split(/(?<=[.!?])\s+/).filter((s) => s.trim()).length;
      return count(lines, 'line');
    }
    case 'skills':
      return count(
        doc.skills.loose.length + doc.skills.groups.reduce((n, g) => n + g.skills.length, 0),
        'skill',
      );
    case 'experience':
      return count(doc.experience.length, 'role');
    case 'projects':
      return count(doc.projects.length, 'project');
    case 'education':
      return count(doc.education.length, 'school');
    case 'certifications':
      return count(doc.certifications.length, 'certification');
    default: {
      const section = doc.custom.find((s) => `x:${s.id}` === key);
      return count((section?.entries.length ?? 0) + (section?.lines.length ?? 0), 'item');
    }
  }
}
