import { buildResumeContent, newId, simulate } from '@/data/mock';
import type {
  ActivityEntry,
  DocumentContent,
  Experience,
  ProfileDraft,
  Resume,
  ResumeContent,
} from '@/data/models';

import { clone, findOrThrow, type MockStore, NotFoundError, PlanLockedError } from './state';
import type { ExportFormat, ResumeExport, ResumesRepo } from './types';

/**
 * NextKin V2 spec §7.12 (downloads and the DOCX gate) and §7.4 (upload, parse, review) — the
 * third slice of the resumes repo, spread into `resumesRepo.ts` alongside the editor half.
 *
 * Nothing here touches the filesystem: a repo cannot, and the real API will hand back a presigned
 * S3 URL rather than bytes. `export` returns render inputs and the screen prints or writes them
 * through `@/lib/exportFile`.
 */
export type ResumeExportRepo = Pick<ResumesRepo, 'export' | 'shareLink' | 'importFromFile'>;

const MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

/** §7.12's convention: FirstName_LastName_JobTitle.ext, with anything unsafe collapsed away. */
const safeSegment = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');

const bulletsToHtml = (bullets: readonly string[]): string =>
  bullets.length ? `<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : '';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * A self-contained document: the style is inline and no asset is referenced, because iOS's
 * `printToFileAsync` renders in a WKWebView that cannot load a local file (a documented
 * expo-print limitation), so an external stylesheet or logo would silently come out blank.
 */
function renderHtml(name: string, content: DocumentContent): string {
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

  const body = [
    `<h1>${escapeHtml(name)}</h1>`,
    content.summary ? `<p>${escapeHtml(content.summary)}</p>` : '',
    section('Skills', content.skills.length ? `<p>${escapeHtml(content.skills.join(' · '))}</p>` : ''),
    section(
      'Experience',
      content.experience
        .map(
          (role) =>
            `<div class="role">${escapeHtml(role.title)} — ${escapeHtml(role.company)}</div>` +
            `<div class="meta">${escapeHtml(role.period)}</div>${bulletsToHtml(role.bullets)}`,
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

/** The same document as plain text — what a portal's paste box gets. */
function renderText(name: string, content: DocumentContent): string {
  if (content.kind === 'cover_letter') {
    return [name, '', content.greeting, '', ...content.paragraphs, '', content.signoff].join('\n');
  }
  const lines: string[] = [name, ''];
  if (content.summary) lines.push(content.summary, '');
  if (content.skills.length) lines.push('SKILLS', content.skills.join(', '), '');
  if (content.experience.length) {
    lines.push('EXPERIENCE');
    for (const role of content.experience) {
      lines.push(`${role.title} — ${role.company} (${role.period})`);
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

export function createResumeExportRepo(store: MockStore): ResumeExportRepo {
  const find = (id: string): Resume => findOrThrow(store.state.resumes, id, 'Resume');

  const readContent = (id: string): DocumentContent => {
    find(id);
    const content: DocumentContent | undefined = store.state.contents[id];
    if (!content) throw new NotFoundError('DocumentContent', id);
    return content;
  };

  const logActivity = (entry: ActivityEntry): void => {
    store.state.activity = [entry, ...store.state.activity];
    store.state.dashboardStats = {
      ...store.state.dashboardStats,
      activitiesCount: store.state.dashboardStats.activitiesCount + 1,
    };
  };

  return {
    export: (id, format) =>
      simulate(() => {
        const resume = find(id);
        const content = readContent(id);
        // §13.3 is emphatic that a clean PDF is never paywalled and never watermarked, on any
        // plan. DOCX is the one gated format, and the UI shows it locked before it is tapped
        // (§13.5) — reaching this means a locked control was bypassed.
        if (format === 'docx' && store.state.subscription.plan === 'free') {
          throw new PlanLockedError('DOCX export');
        }
        const { firstName, lastName } = store.state.user;
        const target = resume.targetRole ?? resume.title;
        const fileName = `${safeSegment(firstName)}_${safeSegment(lastName)}_${safeSegment(target)}.${format}`;
        const displayName = `${firstName} ${lastName}`;

        logActivity({
          id: newId('act'),
          kind: 'export',
          title: `Exported **${resume.title}** as ${format.toUpperCase()}`,
          createdAt: new Date().toISOString(),
          resumeId: resume.id,
        });

        const result: ResumeExport = {
          format,
          fileName,
          mimeType: MIME[format],
          html: renderHtml(displayName, content),
          text: renderText(displayName, content),
        };
        return result;
      }),

    shareLink: (id) =>
      simulate(() => {
        find(id);
        return `https://nextkin.app/r/${id}`;
      }),

    importFromFile: (file) =>
      // Parsing is the slowest thing the intake flow does, and §7.4 wants the progress visible.
      simulate(
        () => {
          const id = newId('res');
          const versionId = newId('ver');
          const createdAt = new Date().toISOString();
          const title = file.name.replace(/\.[^.]+$/, '').trim() || 'Uploaded resume';
          const { profile } = store.state;

          const resume: Resume = {
            id,
            title,
            docType: 'resume',
            createdAt,
            updatedAt: createdAt,
            versionCount: 1,
            currentVersionId: versionId,
            // The first document an empty library gets is the one everything else derives from.
            isBase: !store.state.resumes.some((item) => item.isBase),
            status: 'ready',
            tags: [],
          };
          const content: ResumeContent = buildResumeContent({ resumeId: id, versionId });

          store.state.resumes = [resume, ...store.state.resumes];
          store.state.resumeVersions = [
            ...store.state.resumeVersions,
            { id: versionId, resumeId: id, version: 1, createdAt, changeNote: 'Imported' },
          ];
          store.state.contents[id] = content;

          // §7.4: the parse yields a DRAFT. Nothing here touches the profile — the review screen
          // commits the rows the user accepts, and abandoning it must leave the profile untouched.
          const experiences: Experience[] = profile.experiences.slice(0, 2);
          const draft: ProfileDraft = {
            headline: profile.headline,
            skills: profile.skills.slice(0, 8),
            experiences: clone(experiences),
            education: clone(profile.education),
          };

          return { resume: clone(resume), draft };
        },
        { minMs: 1200, maxMs: 2200 },
      ),
  };
}
