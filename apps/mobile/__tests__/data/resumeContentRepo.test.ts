import { useMockModeStore } from '@/data/mock';
import type { ResumeContent } from '@/data/models';
import { createMockRepos, PlanLockedError, type Repos } from '@/data/repos';

/** Resolves a repo promise by flushing mock latency under fake timers. */
async function flush<T>(promise: Promise<T>): Promise<T> {
  const [value] = await Promise.all([promise, jest.advanceTimersByTimeAsync(3000)]);
  return value;
}

/** The seeded base resume: scored, and the one RESUMES 04's panel is written from. */
const BASE = 'res_base';

const asResume = (content: { kind: string }): ResumeContent => {
  if (content.kind !== 'resume') throw new Error('expected a resume body');
  return content as ResumeContent;
};

describe('ResumesRepo — content, versions and exports (mock)', () => {
  let repos: Repos;

  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    repos = createMockRepos();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getContent()', () => {
    it('returns all six sections of a seeded document', async () => {
      const content = asResume(await flush(repos.resumes.getContent(BASE)));

      expect(content.summary.length).toBeGreaterThan(0);
      expect(content.skills.length).toBeGreaterThan(0);
      expect(content.experience.length).toBeGreaterThan(0);
      expect(content.education.length).toBeGreaterThan(0);
      expect(content.resumeId).toBe(BASE);
    });

    it('misses on a document still being generated rather than half-answering', async () => {
      // res_6 is mid-run: the generation writes its body when it completes.
      await expect(flush(repos.resumes.getContent('res_6'))).rejects.toThrow(
        'DocumentContent "res_6" not found',
      );
    });
  });

  describe('updateSection()', () => {
    it('mints a version and re-scores when a missing keyword lands', async () => {
      const before = await flush(repos.resumes.get(BASE));
      const score = await flush(repos.resumes.getScore(BASE));
      const missing = score.sections
        .flatMap((section) => section.items)
        .find((item) => item.id.startsWith('kw_miss_'));
      const keyword = /"([^"]+)"/.exec(missing?.label ?? '')?.[1];
      expect(keyword).toBeDefined();

      const content = asResume(await flush(repos.resumes.getContent(BASE)));
      await flush(
        repos.resumes.updateSection(BASE, 'skills', [...content.skills, keyword ?? '']),
      );

      const after = await flush(repos.resumes.get(BASE));
      const rescored = await flush(repos.resumes.getScore(BASE));
      expect(after.versionCount).toBe(before.versionCount + 1);
      expect(rescored.total).toBeGreaterThan(score.total);
      expect(
        rescored.sections.flatMap((s) => s.items).find((i) => i.id === missing?.id)?.passed,
      ).toBe(true);
    });
  });

  describe('restoreVersion()', () => {
    it('brings the older body back and files the restore as a new version', async () => {
      const original = asResume(await flush(repos.resumes.getContent(BASE)));
      const originalVersionId = original.versionId;

      await flush(repos.resumes.updateSection(BASE, 'summary', 'A replacement summary.'));
      const edited = await flush(repos.resumes.get(BASE));
      expect(asResume(await flush(repos.resumes.getContent(BASE))).summary).toBe(
        'A replacement summary.',
      );

      const restored = await flush(repos.resumes.restoreVersion(BASE, originalVersionId));
      const body = asResume(await flush(repos.resumes.getContent(BASE)));

      // The text really goes back — the whole point of a restore.
      expect(body.summary).toBe(original.summary);
      // ...and history only ever grows: the restore is a version on top, not an erasure.
      expect(restored.versionCount).toBe(edited.versionCount + 1);
      expect(body.versionId).not.toBe(originalVersionId);
    });

    it('says so when the body predates the fixtures instead of restoring nothing', async () => {
      const versions = await flush(repos.resumes.getVersions(BASE));
      const oldest = versions.at(-1);
      expect(oldest).toBeDefined();

      await expect(flush(repos.resumes.restoreVersion(BASE, oldest?.id ?? ''))).rejects.toThrow(
        /DocumentVersion/,
      );
    });
  });

  describe('export()', () => {
    it('renders a PDF on the free plan — a clean PDF is never paywalled', async () => {
      const result = await flush(repos.resumes.export(BASE, 'pdf'));

      expect(result.fileName).toMatch(/^George_Smith_.*\.pdf$/);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.html).toContain('George Smith');
      expect(result.text).toContain('EXPERIENCE');
    });

    it('locks DOCX on the free plan and opens it on Pro', async () => {
      await expect(flush(repos.resumes.export(BASE, 'docx'))).rejects.toBeInstanceOf(
        PlanLockedError,
      );

      await flush(repos.user.upgrade('pro_monthly'));
      const docx = await flush(repos.resumes.export(BASE, 'docx'));
      expect(docx.fileName.endsWith('.docx')).toBe(true);
    });
  });

  describe('importFromFile()', () => {
    it('returns a draft and leaves the profile untouched until it is accepted', async () => {
      const before = await flush(repos.profile.getProfile());

      const { resume, draft } = await flush(
        repos.resumes.importFromFile({ name: 'George Smith CV.pdf', uri: 'file:///cv.pdf' }),
      );

      expect(resume.title).toBe('George Smith CV');
      expect(draft.experiences?.length).toBeGreaterThanOrEqual(2);
      // V2 §7.4: parsing proposes, the review screen commits.
      const after = await flush(repos.profile.getProfile());
      expect(after).toEqual(before);
    });
  });
});
