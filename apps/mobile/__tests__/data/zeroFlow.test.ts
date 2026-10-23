import { buildZeroDraft, useMockModeStore } from '@/data/mock';
import {
  contentNeedsReview,
  formatZeroPeriod,
  nextZeroCheck,
  parseZeroPeriod,
  zeroCheckRows,
  zeroProgress,
  zeroSummary,
  type ResumeContent,
  type ZeroResolution,
} from '@/data/models';
import { createMockRepos, GENERATION_TICK_MS, type Repos } from '@/data/repos';
import { createMockStore, type MockStore } from '@/data/repos/state';

/** Resolves a repo promise by flushing mock latency under fake timers. */
async function flush<T>(promise: Promise<T>): Promise<T> {
  const [value] = await Promise.all([promise, jest.advanceTimersByTimeAsync(3000)]);
  return value;
}

/** ZERO 01 as drawn: George, 6–10 years, wants Product Designer roles. */
const SEED = {
  fullName: 'George Smith',
  yearsBand: '6-10' as const,
  yearsExperience: 8,
  targetTitle: 'Product Designer',
};

const draft = (): ResumeContent =>
  buildZeroDraft({ resumeId: 'res_z', versionId: 'ver_z', seed: SEED, year: 2026 });

describe('Zero Resume draft (ZERO 03, V2 §7.9)', () => {
  it('drafts three roles for 6–10 years, every company and school a blank — nine things', () => {
    const content = draft();
    expect(content.headline).toBe('Senior Product Designer');
    expect(content.experience.map((role) => [role.title, role.period, role.company])).toEqual([
      ['Senior Product Designer', '2021 — Present', '[Company Name]'],
      ['Product Designer', '2017 — 2021', '[Company Name]'],
      ['Junior Product Designer', '2016 — 2017', '[Company Name]'],
    ]);
    expect(content.education[0]).toMatchObject({
      degree: '[Degree]',
      institution: '[Institution]',
    });
    // The summary claims only what was typed: the role and the years.
    expect(content.summary).toBe('Product designer with 6–10 years of experience.');
    expect(zeroProgress(content)).toEqual({ checked: 0, total: 9, left: 9 });
    expect(zeroCheckRows(content).map((row) => row.title)).toEqual([
      'Roles and dates · 3',
      'Company names · 3 blanks',
      'Skills · 2',
      'Education · 1 blank',
    ]);
  });

  it('drafts no roles for someone starting out', () => {
    const content = buildZeroDraft({
      resumeId: 'res_z',
      versionId: 'ver_z',
      seed: { ...SEED, yearsBand: 'none', yearsExperience: 0 },
      year: 2026,
    });
    expect(content.experience).toEqual([]);
    expect(zeroProgress(content).total).toBe(3);
    expect(zeroCheckRows(content).map((row) => row.group)).toEqual(['skills', 'education']);
  });

  it('reads its own spans back for the check sheet', () => {
    expect(parseZeroPeriod('2021 — Present')).toEqual({ start: { year: 2021 }, end: 'present' });
    expect(parseZeroPeriod('Mar 2017 — Jun 2021')).toEqual({
      start: { year: 2017, month: 3 },
      end: { year: 2021, month: 6 },
    });
    expect(formatZeroPeriod({ year: 2019, month: 8 }, 'present')).toBe('Aug 2019 — Present');
    expect(parseZeroPeriod('sometime')).toBeNull();
  });
});

describe('checking a Zero Resume draft (ZERO 04–05)', () => {
  let store: MockStore;
  let repos: Repos;

  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    store = createMockStore();
    repos = createMockRepos(store);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  /** Starts a run from SEED and ticks it to ready, the way the progress screen watches it. */
  async function readyDraft(): Promise<string> {
    const generation = await flush(repos.generations.start({ kind: 'zero_resume', zero: SEED }));
    repos.generations.subscribe(generation.id, () => undefined);
    await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS * 12);
    const done = store.state.generations.find((item) => item.id === generation.id);
    expect(done?.status).toBe('ready');
    expect(done?.zero?.yearsBand).toBe('6-10');
    return done?.resumeId ?? '';
  }

  const body = (id: string): ResumeContent => {
    const content = store.state.contents[id];
    if (content?.kind !== 'resume') throw new Error('expected a resume body');
    return content;
  };

  it('writes the draft from the seed, gated and unscored', async () => {
    const id = await readyDraft();
    expect(zeroProgress(body(id)).total).toBe(9);
    expect(store.state.resumes.find((resume) => resume.id === id)?.needsReview).toBe(true);
    // D-15: a first draft for no job carries no total.
    expect(store.state.atsScores[id]).toBeUndefined();
  });

  it('keeps the gate shut on a printed placeholder, and lets the editor answer the skills', async () => {
    const id = await readyDraft();
    const roles = body(id).experience;

    // Saving roles by hand clears their flags, but "[Company Name]" is still on the page (§7.9).
    await flush(repos.resumes.updateSection(id, 'experience', roles));
    expect(body(id).experience.every((role) => role.needsReview === false)).toBe(true);
    expect(contentNeedsReview(body(id))).toBe(true);

    // Saving the skills list answers each claim: kept if still listed, removed if not.
    await flush(repos.resumes.updateSection(id, 'skills', ['Figma']));
    expect(body(id).review?.pendingSkills).toEqual([]);
    expect(body(id).review?.removedSkills).toEqual(['Prototyping']);
  });

  it('refuses a blank company, then walks every guess to a filled profile', async () => {
    // Zero Resume is for someone with nothing on NextKin yet (§7.9's "empty profile").
    store.state.profile = { ...store.state.profile, experiences: [], education: [], skills: [] };
    const id = await readyDraft();
    const roles = body(id).experience.map((role) => role.id);

    await expect(
      flush(
        repos.resumes.resolveZeroCheck(id, {
          kind: 'role',
          roleId: roles[0] ?? '',
          title: 'Senior Product Designer',
          company: '  ',
          start: { year: 2021 },
          end: 'present',
        }),
      ),
    ).rejects.toMatchObject({ code: 'ZERO_BLANK' });

    const answers: ZeroResolution[] = [
      {
        kind: 'role',
        roleId: roles[0] ?? '',
        title: 'Senior Product Designer',
        company: 'Flipkart',
        start: { year: 2021, month: 3 },
        end: 'present',
      },
      {
        kind: 'role',
        roleId: roles[1] ?? '',
        title: 'Product Designer',
        company: 'Swiggy',
        start: { year: 2017 },
        end: { year: 2021 },
      },
      { kind: 'role', roleId: roles[2] ?? '', remove: true },
      { kind: 'skill', skill: 'Figma', name: 'Figma' },
      { kind: 'skill', skill: 'Prototyping', remove: true },
    ];
    for (const answer of answers) {
      const result = await flush(repos.resumes.resolveZeroCheck(id, answer));
      expect(result.finished).toBe(false);
    }
    // Two roles confirmed, one deleted, both skills answered: only the school is left.
    expect(zeroProgress(body(id))).toEqual({ checked: 8, total: 9, left: 1 });
    const last = nextZeroCheck(body(id));
    expect(last?.kind).toBe('education');

    const finished = await flush(
      repos.resumes.resolveZeroCheck(id, {
        kind: 'education',
        entryId: last?.kind === 'education' ? last.entry.id : '',
        degree: 'B.Des',
        institution: 'NID Ahmedabad',
        start: { year: 2012 },
        end: { year: 2016 },
      }),
    );

    expect(finished.finished).toBe(true);
    expect(finished.resume.needsReview).toBeUndefined();
    expect(zeroSummary(finished.content)).toEqual([
      '2 roles: titles and dates confirmed',
      '2 company names filled in',
      '1 role removed',
      '1 skill confirmed',
      '1 skill removed',
      'Education filled in',
    ]);
    // §7.9: the confirmed draft becomes the profile.
    const { profile } = store.state;
    expect(profile.experiences.map((entry) => entry.company)).toEqual(['Flipkart', 'Swiggy']);
    expect(profile.experiences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          company: 'Flipkart',
          startDate: '2021-03-01',
          current: true,
        }),
      ]),
    );
    expect(profile.education.map((entry) => entry.institution)).toEqual(['NID Ahmedabad']);
    // The skill said no to stays off the profile.
    expect(profile.skills).toEqual(['Figma']);
  });
});
