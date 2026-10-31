import { buildResumeContent, MockError, newId, simulate } from '../mock';
import type {
  ActivityEntry,
  DocumentContent,
  Experience,
  ProfileDraft,
  Resume,
  ResumeContent,
} from '../models';
import { contentNeedsReview } from '../models';
import { canonicalFromContent } from '../scoring/fromContent';
import { exportProblem } from '../scoring/resumeDocumentCheck';

import { MIME, renderHtml, renderText, safeSegment } from './exportRender';
import {
  clone,
  ExportBlockedError,
  findOrThrow,
  type MockStore,
  NotFoundError,
  PlanLockedError,
} from './state';
import type { ResumeExport, ResumesRepo } from './types';

/**
 * NextKin V2 spec §7.12 (downloads and the DOCX gate) and §7.4 (upload, parse, review) — the
 * third slice of the resumes repo, spread into `resumesRepo.ts` alongside the editor half.
 *
 * Nothing here touches the filesystem: a repo cannot, and the real API will hand back a presigned
 * S3 URL rather than bytes. `export` returns render inputs and the screen prints or writes them
 * through `@/lib/exportFile`.
 */
export type ResumeExportRepo = Pick<
  ResumesRepo,
  'confirmAccuracy' | 'export' | 'shareLink' | 'importFromFile' | 'preview'
>;

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
    // The mock typesets nothing: the screens draw the structured preview.
    preview: (id, versionId) => simulate(() => ({ status: 'structured' as const, versionId: versionId ?? find(id).id, pages: [] })),

    confirmAccuracy: (id) =>
      simulate(() => {
        const resume = find(id);
        const confirmed: Resume = { ...resume, accuracyConfirmed: true };
        store.state.resumes = store.state.resumes.map((item) => (item.id === id ? confirmed : item));
        return clone(confirmed);
      }),

    export: (id, format) =>
      simulate(() => {
        const resume = find(id);
        const content = readContent(id);
        // The same gates the backend holds, in the same order: an open Zero Resume review (§7.9),
        // DOCX on the free plan, an unverified email (§7.1), then the once-per-version accuracy
        // confirmation (§15 risk 2).
        if (contentNeedsReview(content)) throw new ExportBlockedError('review');
        if (content.kind === 'resume') {
          const { firstName, lastName, email } = store.state.user;
          const problem = exportProblem(canonicalFromContent(content), { name: `${firstName} ${lastName}`.trim(), email });
          if (problem) throw new ExportBlockedError('incomplete', problem);
        }
        // §13.3 is emphatic that a clean PDF is never paywalled and never watermarked, on any
        // plan. DOCX is the one gated format, and the UI shows it locked before it is tapped
        // (§13.5) — reaching this means a locked control was bypassed.
        if (format === 'docx' && store.state.subscription.plan === 'free') {
          throw new PlanLockedError('DOCX export');
        }
        if (store.state.user.emailVerified === false) throw new ExportBlockedError('email');
        if (!resume.accuracyConfirmed) throw new ExportBlockedError('accuracy');
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
          delivery: 'render',
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
        return `https://nextkin.ai/r/${id}`;
      }),

    importFromFile: (file) =>
      // Parsing is the slowest thing the intake flow does, and §7.4 wants the progress visible.
      simulate(
        () => {
          // §7.4 reads text, not pictures: a scan or a photo has nothing to parse (TAILOR 01c).
          // The mock recognises one by its name or type, so the failure can be demoed.
          if (/scan|photo/i.test(file.name) || file.mimeType?.startsWith('image/')) {
            throw new MockError('UNREADABLE_FILE', "We couldn't read this file");
          }
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
          const content: ResumeContent = buildResumeContent({
            resumeId: id,
            versionId,
          });

          store.state.resumes = [resume, ...store.state.resumes];
          store.state.resumeVersions = [
            ...store.state.resumeVersions,
            {
              id: versionId,
              resumeId: id,
              version: 1,
              createdAt,
              changeNote: 'Imported',
            },
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
