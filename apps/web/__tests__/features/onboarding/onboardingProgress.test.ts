import { useOnboardingStore } from '@/features/onboarding/onboardingStore';
import { ONBOARDING_PAGES, progressOf } from '@/features/onboarding/onboardingSteps';

/** Redesign R7c: progress only moves forward (OB-04), and the answers survive a reload (OB-05). */
const page = (key: string) => {
  const found = ONBOARDING_PAGES.find((p) => p.key === key);
  if (!found) throw new Error(key);
  return found;
};

describe('onboarding progress', () => {
  it('never goes back along either way through', () => {
    const build = ['name', 'goal', 'experience', 'resume', 'work', 'skills', 'education', 'done'];
    const upload = ['name', 'goal', 'experience', 'resume', 'upload', 'done'];
    for (const path of [build, upload]) {
      const values = path.map((key) => progressOf(page(key)));
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1] as number);
      }
      expect(values.at(-1)).toBe(1);
    }
  });
});

describe('onboarding answers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useOnboardingStore.getState().reset();
  });

  it('are kept for the tab as they are given', () => {
    useOnboardingStore.getState().answer({ name: 'Ada Lovelace', goal: 'better_role' });
    const saved = JSON.parse(sessionStorage.getItem('nextkin:onboarding') ?? '{}');
    expect(saved.state).toMatchObject({ name: 'Ada Lovelace', goal: 'better_role' });
  });

  it('come back after a reload', async () => {
    // A fresh page: memory is empty, and the tab holds the earlier answers.
    sessionStorage.setItem(
      'nextkin:onboarding',
      JSON.stringify({ state: { name: 'Ada Lovelace', goal: 'better_role' }, version: 0 }),
    );
    await useOnboardingStore.persist.rehydrate();
    expect(useOnboardingStore.getState()).toMatchObject({
      name: 'Ada Lovelace',
      goal: 'better_role',
    });
  });
});
