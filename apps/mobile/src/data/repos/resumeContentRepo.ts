import { buildResumeContent, newId, rescore, simulate } from '@/data/mock';
import type {
  AtsCheckItem,
  AtsScore,
  CoverLetterContent,
  DocumentContent,
  ProfileLink,
  Resume,
  ResumeContent,
  ResumeSectionKey,
} from '@/data/models';
import { RESUME_SECTION_LABEL } from '@/data/models';

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

const nowIso = (): string => new Date().toISOString();

/**
 * One section written back. The cast is TS's computed-key limit, not a widening: `value` is
 * already typed `ResumeContent[K]`.
 */
const withSection = <K extends ResumeSectionKey>(
  content: ResumeContent,
  section: K,
  value: ResumeContent[K],
): ResumeContent => ({ ...content, [section]: value }) as ResumeContent;

/**
 * Zero Resume Mode flags what it assumed (§7.9); typing over an entry by hand confirms it. Only
 * the section the caller replaced loses its flags — the rest of the document is still unreviewed.
 */
function confirmReviewed(content: ResumeContent, section: ResumeSectionKey): ResumeContent {
  switch (section) {
    case 'experience':
      return {
        ...content,
        experience: content.experience.map((role) => ({ ...role, needsReview: false })),
      };
    case 'projects':
      return {
        ...content,
        projects: content.projects.map((project) => ({ ...project, needsReview: false })),
      };
    case 'education':
      return {
        ...content,
        education: content.education.map((entry) => ({ ...entry, needsReview: false })),
      };
    default:
      return content;
  }
}

const rotate = <T>(items: T[]): T[] => {
  const [first, ...rest] = items;
  return first === undefined ? items : [...rest, first];
};

/** Sentence split that keeps its punctuation, so a rotated summary still reads as prose. */
const sentences = (text: string): string[] =>
  text.match(/[^.!?]+[.!?]*/g)?.map((part) => part.trim()) ?? [text];

/**
 * A regenerate has to read as a new draft, and §7.9 forbids inventing a fact the profile cannot
 * back — so the mock re-runs the builder and, where that hands back what is already on the page,
 * reorders what is there rather than writing a new claim.
 */
function regenerated(
  content: ResumeContent,
  fresh: ResumeContent,
  section: ResumeSectionKey,
): ResumeContent {
  switch (section) {
    case 'summary': {
      const rotated = rotate(sentences(content.summary)).join(' ');
      return { ...content, summary: fresh.summary === content.summary ? rotated : fresh.summary };
    }
    case 'skills':
      return { ...content, skills: rotate(fresh.skills) };
    case 'experience':
      return {
        ...content,
        experience: fresh.experience.map((role) => ({ ...role, bullets: rotate(role.bullets) })),
      };
    case 'projects':
      return {
        ...content,
        projects: fresh.projects.map((project) => ({
          ...project,
          bullets: rotate(project.bullets),
        })),
      };
    case 'certifications':
      return { ...content, certifications: rotate(fresh.certifications) };
    case 'education':
      return { ...content, education: fresh.education.map((entry) => ({ ...entry })) };
  }
}

/** The keyword out of `Missing: "A/B testing"` — the label is the only place it is recorded. */
const quoted = (label: string): string | undefined => /"([^"]+)"/.exec(label)?.[1];

/**
 * Countable and generic on purpose: the fix has to give the §7.8 `content_gap` check a bullet
 * with a number in it without inventing a result the profile cannot back (§7.9).
 */
const QUANTIFIED_BULLET =
  'Tracked the outcome of 3 shipped projects, reporting before-and-after metrics';

/** Patches the document for one quick win, where that item's `section` says the fix lands. */
function patchForFix(
  content: ResumeContent,
  item: AtsCheckItem,
  links: ProfileLink[],
): ResumeContent {
  if (item.id.startsWith('kw_miss_')) {
    const keyword = quoted(item.label);
    if (!keyword) throw new NotFoundError('AtsFix', item.id);
    if (content.skills.includes(keyword)) return content;
    return { ...content, skills: [...content.skills, keyword] };
  }
  if (item.id === 'content_gap') {
    const [first, ...rest] = content.experience;
    if (!first) throw new NotFoundError('AtsFix', item.id);
    return {
      ...content,
      experience: [{ ...first, bullets: [...first.bullets, QUANTIFIED_BULLET] }, ...rest],
    };
  }
  if (item.id === 'portfolio') {
    const portfolio = links.find((link) => link.kind === 'portfolio' || link.label === 'Portfolio');
    // The §7.8 rule that governs keywords governs links too: with no portfolio on the profile
    // there is nothing the product may put in the document.
    if (!portfolio) throw new NotFoundError('AtsFix', item.id);
    return { ...content, links: [...(content.links ?? []), portfolio.url] };
  }
  throw new NotFoundError('AtsFix', item.id);
}

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
    store.state.resumes = store.state.resumes.map((item) => (item.id === resume.id ? updated : item));
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
        const item = score.sections.flatMap((section) => section.items).find((i) => i.id === itemId);
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
        // §7.11: history is never rewritten. A restore lands as a new version on top of the ones
        // that followed it, so the list only ever grows.
        const restored = bumpVersion(resume, `Restored v${version.version}`);
        const body: DocumentContent | undefined = store.state.contents[id];
        if (body) store.state.contents[id] = { ...body, versionId: restored.versionId };
        return clone(restored.resume);
      }),
  };
}
