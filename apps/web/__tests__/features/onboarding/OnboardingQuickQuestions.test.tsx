import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { skillSuggestionsForTitle } from '@nextkin/shared/models';
import type { MockMode } from '@nextkin/shared/mock';
import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { useOnboardingStore } from '@/features/onboarding/onboardingStore';
import { endOfMonth, monthLabel } from '@/features/onboarding/months';
import { SkillsStepScreen } from '@/features/onboarding/screens/SkillsStepScreen';
import { WorkStepScreen } from '@/features/onboarding/screens/WorkStepScreen';
import { card, continueButton, renderInFrame, row, wait } from '../../../testSupport/onboarding';
import { SETTLE_MS } from '../../../testSupport/render';

/** Web onboarding ONB 05 and 06, the quick questions after "No, help me make one" (808:88, 808:175; `toreview.md` §107.3). */

const push = jest.fn();
let pathname = '/onboarding/work';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

jest.setTimeout(20_000);

function renderStep(path: string, ui: ReactElement, mode?: MockMode) {
  pathname = path;
  return renderInFrame(ui, mode);
}

describe('Web onboarding · quick questions', () => {
  beforeEach(() => {
    resetMockRepos();
    useOnboardingStore.getState().reset();
    push.mockClear();
  });

  describe('ONB 05 · recent work', () => {
    it('starts from the latest role, saves an edit, and fills Recent job', async () => {
      const user = userEvent.setup();
      const before = await repos.profile.getProfile();
      const latest = before.experiences.find((e) => e.current) ?? before.experiences[0];
      renderStep('/onboarding/work', <WorkStepScreen />);
      expect(screen.getByText('A few quick questions · 1 of 3')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Skip for now' })).toBeInTheDocument();
      expect(within(card()).queryByText('Resume')).not.toBeInTheDocument();

      const title = await screen.findByLabelText('Job title', {}, wait);
      await waitFor(() => expect(title).toHaveValue(latest?.title), wait);
      expect(screen.getByLabelText('Company')).toHaveValue(latest?.company);
      expect(screen.getByRole('button', { name: /^To Present$/ })).toBeInTheDocument();

      await user.clear(screen.getByLabelText('Company'));
      await user.type(screen.getByLabelText('Company'), 'Flipkart');
      expect(
        within(row('Recent job')).getByText(`${latest?.title} · Flipkart`),
      ).toBeInTheDocument();

      await user.click(continueButton());
      expect(push).toHaveBeenCalledWith('/onboarding/skills');
      await waitFor(async () => {
        const saved = (await repos.profile.getProfile()).experiences.find(
          (e) => e.id === latest?.id,
        );
        expect(saved?.company).toBe('Flipkart');
      }, wait);
    });

    it('needs every field of an added role, and skips the lot for no work yet', async () => {
      const user = userEvent.setup();
      renderStep('/onboarding/work', <WorkStepScreen />);
      await screen.findByLabelText('Job title', {}, wait);
      await waitFor(() => expect(continueButton()).toBeEnabled(), wait);

      await user.click(screen.getByRole('button', { name: 'Add another role' }));
      expect(screen.getByRole('group', { name: 'Role 2' })).toBeInTheDocument();
      expect(continueButton()).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Remove' }));
      expect(continueButton()).toBeEnabled();

      const countBefore = (await repos.profile.getProfile()).experiences.length;
      await user.click(screen.getByLabelText('I haven’t worked yet — skip this'));
      expect(within(row('Recent job')).getByText('Not yet')).toBeInTheDocument();
      await user.click(continueButton());
      expect(push).toHaveBeenCalledWith('/onboarding/skills');
      expect((await repos.profile.getProfile()).experiences).toHaveLength(countBefore);
    });
  });

  describe('ONB 06 · skills', () => {
    it('suggests from the job title, keeps the profile’s picks, and saves the set', async () => {
      const user = userEvent.setup();
      useOnboardingStore.setState({
        roles: [
          {
            id: 'r1',
            title: 'Senior UX Designer',
            company: 'Flipkart',
            from: '2022-03',
            to: 'present',
            skills: [],
          },
        ],
      });
      const profile = await repos.profile.getProfile();
      renderStep('/onboarding/skills', <SkillsStepScreen />);
      expect(screen.getByText('A few quick questions · 2 of 3')).toBeInTheDocument();

      const skills = await screen.findByRole('list', { name: 'Skills' }, wait);
      expect(within(skills).getByRole('button', { name: 'Design QA' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      const first = profile.skills[0] ?? '';
      expect(within(skills).getByRole('button', { name: first })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(
        within(row('Skills')).getByText(`${profile.skills.length} picked`),
      ).toBeInTheDocument();

      await user.click(within(skills).getByRole('button', { name: 'Design QA' }));
      await user.type(screen.getByLabelText('Add your own'), 'Service blueprints{Enter}');
      expect(push).not.toHaveBeenCalled();
      expect(within(skills).getByRole('button', { name: 'Service blueprints' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByLabelText('Add your own')).toHaveValue('');

      await user.click(continueButton());
      expect(push).toHaveBeenCalledWith('/onboarding/education');
      await waitFor(async () => {
        const saved = (await repos.profile.getProfile()).skills;
        expect(saved).toEqual(expect.arrayContaining(['Design QA', 'Service blueprints', first]));
      }, wait);
      // The save refetches the profile; let it land before the test ends.
      await act(() => new Promise((resolve) => setTimeout(resolve, SETTLE_MS.normal)));
    });

    it('offers each family its own suggestions', () => {
      expect(skillSuggestionsForTitle('Senior UX Designer')).toContain('Design systems');
      expect(skillSuggestionsForTitle('Product Manager')).toContain('Roadmapping');
      expect(skillSuggestionsForTitle('Backend Engineer')).toContain('SQL');
      expect(skillSuggestionsForTitle('Chef')).toContain('Communication');
      expect(skillSuggestionsForTitle(undefined)).toContain('Communication');
    });
  });

  it('formats months and ends them on their last day', () => {
    expect(monthLabel('2022-03')).toBe('Mar 2022');
    expect(endOfMonth('2022-02')).toBe('2022-02-28');
    expect(endOfMonth('2024-02')).toBe('2024-02-29');
    expect(endOfMonth('2023-12')).toBe('2023-12-31');
  });
});
