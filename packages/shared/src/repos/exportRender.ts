import type { ContentRole, DocumentContent, ResumeContent } from '../models';

import type { ExportFormat } from './types';

/**
 * The mock data layer's export rendering (V2 §7.12): a self-contained HTML document the device
 * prints to PDF, and the same document as plain text. The backend renders real files on its
 * worker instead (packages/server/src/export); this stays for mock mode only.
 */

export const MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

/** §7.12's convention: FirstName_LastName_JobTitle.ext, with anything unsafe collapsed away. */
export const safeSegment = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');

const bulletsToHtml = (bullets: readonly string[]): string =>
  bullets.length ? `<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : '';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * A self-contained document: the style is inline and no asset is referenced, because iOS's
 * `printToFileAsync` renders in a WKWebView that cannot load a local file (a documented
 * expo-print limitation), so an external stylesheet or logo would silently come out blank.
 */
export function renderHtml(name: string, content: DocumentContent): string {
  const style =
    'body{font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.45;' +
    'color:#111827;margin:32px}h1{font-size:20pt;margin:0 0 2px}h2{font-size:12pt;margin:18px 0 6px;' +
    'text-transform:uppercase;letter-spacing:.06em;color:#4b5563}ul{margin:4px 0 0;padding-left:18px}' +
    'li{margin:0 0 3px}p{margin:0 0 8px}.role{font-weight:600;margin-top:10px}.meta{color:#6b7280}';
  const head = `<meta charset="utf-8"><title>${escapeHtml(name)}</title><style>${style}</style>`;

  if (content.kind === 'cover_letter') {
    const body = [
      `<h1>${escapeHtml(name)}</h1>`,
      `<p>${escapeHtml(content.greeting)}</p>`,
      ...content.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
      `<p>${escapeHtml(content.signoff).replace(/\n/g, '<br>')}</p>`,
    ].join('');
    return `<html><head>${head}</head><body>${body}</body></html>`;
  }

  const section = (title: string, inner: string): string =>
    inner ? `<h2>${title}</h2>${inner}` : '';
  const contact = contactLine(content);

  const body = [
    `<h1>${escapeHtml(name)}</h1>`,
    content.headline ? `<p class="role">${escapeHtml(content.headline)}</p>` : '',
    contact.length ? `<p class="meta">${contact.map(escapeHtml).join(' · ')}</p>` : '',
    content.summary ? `<p>${escapeHtml(content.summary)}</p>` : '',
    section(
      'Skills',
      content.skills.length ? `<p>${escapeHtml(content.skills.join(' · '))}</p>` : '',
    ),
    section(
      'Experience',
      content.experience
        .map(
          (role) =>
            `<div class="role">${escapeHtml(role.title)} — ${escapeHtml(role.company)}</div>` +
            `<div class="meta">${escapeHtml(roleMeta(role))}</div>${bulletsToHtml(role.bullets)}`,
        )
        .join(''),
    ),
    section(
      'Projects',
      content.projects
        .map(
          (project) =>
            `<div class="role">${escapeHtml(project.name)}</div>` +
            `<div class="meta">${escapeHtml(project.description)}</div>` +
            bulletsToHtml(project.bullets),
        )
        .join(''),
    ),
    section(
      'Education',
      content.education
        .map(
          (entry) =>
            `<div class="role">${escapeHtml(entry.degree)}</div>` +
            `<div class="meta">${escapeHtml(entry.institution)} · ${escapeHtml(entry.period)}</div>`,
        )
        .join(''),
    ),
    section(
      'Certifications',
      content.certifications.length
        ? `<p>${escapeHtml(content.certifications.join(' · '))}</p>`
        : '',
    ),
  ].join('');
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

/**
 * The header line under the name: email, phone and place, then any profile links. Empty for a
 * document that carries none of them, which leaves its export exactly as it was.
 */
function contactLine(content: ResumeContent): string[] {
  const { email, phone, location } = content.contact ?? {};
  return [email, phone, location, ...(content.links ?? [])].filter(
    (value): value is string => !!value,
  );
}

/** "Bengaluru, India · Jan 2022 – Present", or just the period when the role names no place. */
const roleMeta = (role: ContentRole): string =>
  role.location ? `${role.location} · ${role.period}` : role.period;

/** The same document as plain text — what a portal's paste box gets. */
export function renderText(name: string, content: DocumentContent): string {
  if (content.kind === 'cover_letter') {
    return [name, '', content.greeting, '', ...content.paragraphs, '', content.signoff].join('\n');
  }
  const lines: string[] = [name];
  if (content.headline) lines.push(content.headline);
  const contact = contactLine(content);
  if (contact.length) lines.push(contact.join(' · '));
  lines.push('');
  if (content.summary) lines.push(content.summary, '');
  if (content.skills.length) lines.push('SKILLS', content.skills.join(', '), '');
  if (content.experience.length) {
    lines.push('EXPERIENCE');
    for (const role of content.experience) {
      lines.push(`${role.title} — ${role.company} (${roleMeta(role)})`);
      lines.push(...role.bullets.map((bullet) => `  • ${bullet}`));
      lines.push('');
    }
  }
  if (content.education.length) {
    lines.push('EDUCATION');
    lines.push(...content.education.map((e) => `${e.degree} — ${e.institution} (${e.period})`));
  }
  return lines.join('\n');
}
