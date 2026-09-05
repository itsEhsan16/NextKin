import { buildResumeContent, newId, rescore, simulate } from '@/data/mock';
import type {
  AtsScore,
  CoverLetterContent,
  DocumentContent,
  Resume,
  ResumeContent,
  ResumeSectionKey,
} from '@/data/models';
import { RESUME_SECTION_LABEL } from '@/data/models';

import {
  confirmReviewed,
  nowIso,
  patchForFix,
  regenerated,
  withSection,
} from './resumeContentEdits';
import { clone, findOrThrow, type MockStore, NotFoundError } from './state';
import type { ResumesRepo } from './types';

/**
 * NextKin V2 spec §7.11 (the structured section editor and its append-only history) and §7.8
 * (the quick-win fixes) — the editing half of the resumes repo, spread into `resumesRepo.ts` so
 * the swap contract stays one `ResumesRepo`. `Pick` is what keeps these signatures from drifting
 * away from that contract. No artboard draws the editor, so the citations are spec sections.
 */
export type ResumeContentRepo = Pick<
  ResumesRepo,
  | 'create'
  | 'getContent'
  | 'updateSection'
  | 'updateLetter'
  | 'regenerateSection'
  | 'applyAtsFix'
  | 'restoreVersion'
>;

export function createResumeContentRepo(store: MockStore): ResumeContentRepo {
  const find = (id: string): Resume => findOrThrow(store.state.resumes, id, 'Resume');

  /** The resume is looked up first, so a bad id says "Resume", not "DocumentContent". */
  const readContent = (id: string): DocumentContent => {
    find(id);
    const content: DocumentContent | undefined = store.state.contents[id];
    // res_6 is mid-generation: the run writes its body when it completes, and until then a read
    // has to miss rather than hand back a half-written document.
    if (!content) throw new NotFoundError('DocumentContent', id);
    return content;
  };

  /** §7.11's six sections belong to a resume; a letter is greeting / paragraphs / signoff. */
  const readSections = (id: string, section: ResumeSectionKey): ResumeContent => {
    const content = readContent(id);
    if (content.kind === 'cover_letter') throw new NotFoundError('ResumeSection', section);
    return content;
  };

  /** §7.11 never rewrites history: every write mints a version rather than editing the head. */
  const bumpVersion = (resume: Resume, note: string): { resume: Resume; versionId: string } => {
    const createdAt = nowIso();
    const versionId = newId('ver');
    const version = resume.versionCount + 1;
    const updated: Resume = {
      ...resume,
      updatedAt: createdAt,
      versionCount: version,
      currentVersionId: versionId,
    };
    store.state.resumes = store.state.resumes.map((item) =>
      item.id === resume.id ? updated : item,
    );
    store.state.resumeVersions = [
      ...store.state.resumeVersions,
      { id: versionId, resumeId: resume.id, version, createdAt, changeNote: note },
    ];
    return { resume: updated, versionId };
  };

  /** Re-score on edit (§7.8). A document that has never been scored stays unscored. */
  const rescoreDocument = (id: string, content: ResumeContent): AtsScore | undefined => {
    const previous: AtsScore | undefined = store.state.atsScores[id];
    if (!previous) return undefined;
    const next = rescore(previous, content);
    store.state.atsScores[id] = next;
    store.state.resumes = store.state.resumes.map((item) =>
      item.id === id ? { ...item, atsScore: next.total } : item,
    );
    return next;
  };

  /** Stores the body against the version the edit just minted, so the two never disagree. */
  const save = (id: string, content: ResumeContent, versionId: string): ResumeContent => {
    const stored: ResumeContent = { ...content, versionId };
    store.state.contents[id] = stored;
    // The same body filed under its version, so §7.11's restore has something to go back to.
    // Without this a restore can only re-stamp the current text and looks like it did nothing.
    store.state.contentVersions[versionId] = stored;
    return stored;
  };

  return {
    create: ({ title, docType }) =>
      simulate(() => {
        const id = newId('res');
        const versionId = newId('ver');
        const createdAt = nowIso();
        const resume: Resume = {
          id,
          title: title.trim(),
          docType,
          createdAt,
          updatedAt: createdAt,
          versionCount: 1,
          currentVersionId: versionId,
          status: 'ready',
          tags: [],
          // No `atsScore`: an empty document has nothing to score, and the editor must not query
          // a score until one is set — `getScore` misses until a scoring run writes one.
        };
        store.state.contents[id] =
          docType === 'cover_letter'
            ? {
                kind: 'cover_letter',
                resumeId: id,
                versionId,
                tone: 'professional',
                greeting: '',
                paragraphs: [],
                signoff: '',
              }
            : buildResumeContent({ resumeId: id, versionId, blank: true });
        store.state.resumes = [resume, ...store.state.resumes];
        store.state.resumeVersions = [
          ...store.state.resumeVersions,
          { id: versionId, resumeId: id, version: 1, createdAt, changeNote: 'Created' },
        ];
        return clone(resume);
      }),

    getContent: (id) => simulate(() => clone(readContent(id))),

    updateSection: (id, section, value) =>
      simulate(() => {
        const resume = find(id);
        const content = readSections(id, section);
        const next = confirmReviewed(withSection(content, section, clone(value)), section);
        const { versionId } = bumpVersion(resume, `Edited ${RESUME_SECTION_LABEL[section]}`);
        const stored = save(id, next, versionId);
        rescoreDocument(id, stored);
        return clone(stored);
      }),

    updateLetter: (id, patch) =>
      simulate(() => {
        const resume = find(id);
        const content = readContent(id);
        // A resume has sections, not a greeting — `updateSection` is the writer for that half.
        if (content.kind !== 'cover_letter') throw new NotFoundError('CoverLetter', id);
        const { versionId } = bumpVersion(resume, 'Edited letter');
        const stored: CoverLetterContent = { ...content, ...clone(patch), versionId };
        store.state.contents[id] = stored;
        return clone(stored);
      }),

    regenerateSection: (id, section) =>
      simulate(
        () => {
          const resume = find(id);
          const content = readSections(id, section);
          const fresh = buildResumeContent({
            resumeId: id,
            versionId: content.versionId,
            targetRole: resume.targetRole,
            targetCompany: resume.targetCompany,
          });
          const next = confirmReviewed(regenerated(content, fresh, section), section);
          const { versionId } = bumpVersion(resume, `Regenerated ${RESUME_SECTION_LABEL[section]}`);
          const stored = save(id, next, versionId);
          rescoreDocument(id, stored);
          return clone(stored);
        },
        // An AI call, not a save: the section holds a shimmer for as long as this runs.
        { minMs: 1500 },
      ),

    applyAtsFix: (id, itemId) =>
      simulate(() => {
        const resume = find(id);
        const content = readContent(id);
        const score: AtsScore | undefined = store.state.atsScores[id];
        if (!score || content.kind === 'cover_letter') throw new NotFoundError('AtsFix', itemId);
        const item = score.sections
          .flatMap((section) => section.items)
          .find((i) => i.id === itemId);
        // §7.8 forbids handing back a keyword the profile does not support: a gap
        // (`supported: false`) is shown and never inserted, so it must not become applicable by
        // this route either, whatever flags the panel put on it.
        if (!item || !item.fixable || item.supported === false)
          throw new NotFoundError('AtsFix', itemId);
        const patched = patchForFix(content, item, store.state.profile.links);
        const { versionId } = bumpVersion(resume, 'Applied fix');
        const stored = save(id, patched, versionId);
        // Both caches move together: the panel and the document come out of the same write.
        const next = rescoreDocument(id, stored) ?? score;
        return { content: clone(stored), score: clone(next) };
      }),

    restoreVersion: (id, versionId) =>
      simulate(() => {
        const resume = find(id);
        const version = findOrThrow(store.state.resumeVersions, versionId, 'ResumeVersion');
        if (version.resumeId !== id) throw new NotFoundError('ResumeVersion', versionId);
        // The body as it stood at that version. A version older than the fixtures has none, and
        // saying so is the honest answer: re-saving the current text would present a restore that
        // changed nothing as a restore that worked.
        const body: DocumentContent | undefined = store.state.contentVersions[versionId];
        if (!body) throw new NotFoundError('DocumentVersion', versionId);
        // §7.11: history is never rewritten. A restore lands as a new version on top of the ones
        // that followed it, so the list only ever grows.
        const restored = bumpVersion(resume, `Restored v${version.version}`);
        const stored: DocumentContent = { ...body, versionId: restored.versionId };
        store.state.contents[id] = stored;
        store.state.contentVersions[restored.versionId] = stored;
        return clone(restored.resume);
      }),
  };
}
