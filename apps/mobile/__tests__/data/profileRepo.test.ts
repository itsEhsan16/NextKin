import { profileFixture, useMockModeStore } from '@/data/mock';
import type { Certification, Experience } from '@/data/models';
import { createMockRepos, type Repos } from '@/data/repos';

/** Resolves a repo promise by flushing mock latency under fake timers. */
async function flush<T>(promise: Promise<T>): Promise<T> {
  const [value] = await Promise.all([promise, jest.advanceTimersByTimeAsync(3000)]);
  return value;
}

const NEW_ROLE: Experience = {
  id: '',
  company: 'Zoho',
  title: 'Design Lead',
  startDate: '2024-01-01',
  current: true,
  skills: ['Design systems'],
};

const role = (): Experience => ({ ...NEW_ROLE, skills: [...NEW_ROLE.skills] });

describe('ProfileRepo (mock)', () => {
  let repos: Repos;

  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    repos = createMockRepos();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('upsertExperience()', () => {
    it('appends an entry with a fresh id and moves the meter', async () => {
      const profile = await flush(repos.profile.upsertExperience(role()));

      expect(profile.experiences).toHaveLength(profileFixture.experiences.length + 1);
      const added = profile.experiences.at(-1);
      expect(added?.company).toBe('Zoho');
      expect(added?.id).not.toBe('');
      expect(added?.id.startsWith('exp_')).toBe(true);
      expect(profile.completeness).toBeCloseTo(profileFixture.completeness + 0.02, 2);
    });

    it('replaces a known id where it already sits, without reordering', async () => {
      const before = await flush(repos.profile.getProfile());
      const existing = before.experiences[1];
      expect(existing?.id).toBe('exp_2');

      const profile = await flush(
        repos.profile.upsertExperience({ ...existing!, title: 'Staff Product Designer' }),
      );

      expect(profile.experiences).toHaveLength(before.experiences.length);
      expect(profile.experiences.map((item) => item.id)).toEqual(
        before.experiences.map((item) => item.id),
      );
      expect(profile.experiences[1]?.title).toBe('Staff Product Designer');
      // An edit is not an addition, so the meter stays where it was.
      expect(profile.completeness).toBe(before.completeness);
    });

    it('appends onto an empty list too (certifications start empty)', async () => {
      const entry: Certification = { id: '', name: 'NN/g UX Certification', issuer: 'NN/g' };
      const profile = await flush(repos.profile.upsertCertification(entry));

      expect(profile.certifications).toHaveLength(1);
      expect(profile.certifications[0]?.id.startsWith('cert_')).toBe(true);
    });
  });

  describe('removeExperience()', () => {
    it('filters the role out and lowers completeness', async () => {
      const profile = await flush(repos.profile.removeExperience('exp_4'));

      expect(profile.experiences.map((item) => item.id)).toEqual(['exp_1', 'exp_2', 'exp_3']);
      expect(profile.completeness).toBeCloseTo(profileFixture.completeness - 0.02, 2);
    });

    it('rejects an unknown id with the standard message', async () => {
      await expect(flush(repos.profile.removeExperience('nope'))).rejects.toThrow(
        'Experience "nope" not found',
      );
    });
  });

  it('updateSkills() writes the list and answers the "Add skills" step', async () => {
    const profile = await flush(repos.profile.updateSkills([...profileFixture.skills, 'GraphQL']));

    expect(profile.skills).toContain('GraphQL');
    expect(profile.nextSteps.map((step) => step.id)).toEqual(['step_salary']);
    expect(profile.completeness).toBeCloseTo(profileFixture.completeness + 0.02, 2);
  });

  it('updateProfile() moves the meter when it fills a blank identity field', async () => {
    const edited = await flush(repos.profile.updateProfile({ headline: 'Design Systems Lead' }));
    expect(edited.headline).toBe('Design Systems Lead');
    // Rewriting a field that was already filled is not an addition.
    expect(edited.completeness).toBe(profileFixture.completeness);

    const cleared = await flush(repos.profile.updateProfile({ headline: '' }));
    expect(cleared.completeness).toBeCloseTo(profileFixture.completeness - 0.02, 2);

    const refilled = await flush(repos.profile.updateProfile({ headline: 'Senior UX Designer' }));
    expect(refilled.completeness).toBeCloseTo(profileFixture.completeness, 2);
  });

  it('applyProfileDraft() skips rows the profile already holds (V2 §7.4)', async () => {
    const profile = await flush(
      repos.profile.applyProfileDraft({
        skills: ['figma', 'GraphQL', 'graphql'],
        experiences: [
          { ...role(), id: 'draft_1', company: 'flipkart', title: 'Senior UX Designer' },
          { ...role(), id: 'draft_2' },
        ],
        education: [
          {
            id: 'draft_edu',
            institution: 'Anna University',
            degree: 'M.Sc.',
            startDate: '2016-01-01',
            current: false,
          },
        ],
      }),
    );

    // "figma" duplicates "Figma" and the second "graphql" duplicates the first, case-insensitively.
    expect(profile.skills).toEqual([...profileFixture.skills, 'GraphQL']);
    // The Flipkart row matches an existing company AND title, so only Zoho lands — with a new id.
    expect(profile.experiences).toHaveLength(profileFixture.experiences.length + 1);
    expect(profile.experiences.at(-1)?.company).toBe('Zoho');
    expect(profile.experiences.at(-1)?.id).not.toBe('draft_2');
    // Education matches on institution alone, and Anna University is already there.
    expect(profile.education).toHaveLength(profileFixture.education.length);
  });

  it('never pushes completeness above 1', async () => {
    const many = Array.from({ length: 60 }, (_, index) => `Skill ${index}`);
    const profile = await flush(repos.profile.updateSkills(many));

    expect(profile.completeness).toBe(1);
  });

  it('hands out copies and stores copies, never the caller reference', async () => {
    const handed = await flush(repos.profile.getProfile());
    handed.skills.push('mutated');
    expect((await flush(repos.profile.getProfile())).skills).not.toContain('mutated');

    const entry = role();
    await flush(repos.profile.upsertExperience(entry));
    entry.company = 'mutated';
    entry.skills.push('mutated');

    const after = await flush(repos.profile.getProfile());
    expect(after.experiences.some((item) => item.company === 'mutated')).toBe(false);
    expect(after.experiences.at(-1)?.skills).toEqual(['Design systems']);
    expect(profileFixture.experiences).toHaveLength(4);
  });
});
