import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import type { MockMode } from '@nextkin/shared/mock';
import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { useOnboardingStore } from '@/features/onboarding/onboardingStore';
import { ExperienceStepScreen } from '@/features/onboarding/screens/ExperienceStepScreen';
import { GoalStepScreen } from '@/features/onboarding/screens/GoalStepScreen';
import { NameStepScreen, splitName } from '@/features/onboarding/screens/NameStepScreen';
import { continueButton, renderInFrame, row, wait } from '../../../testSupport/onboarding';
import { SETTLE_MS } from '../../../testSupport/render';

/** Web onboarding ONB 01–03: name, goal, experience (807:3, 826:2, 807:136; `toreview.md` §106–§107). */

const push = jest.fn();
let pathname = '/onboarding';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

jest.setTimeout(20_000);

function renderStep(path: string, ui: ReactElement, mode?: MockMode) {
  pathname = path;
  return renderInFrame(ui, mode);
}

describe('Web onboarding · questions', () => {
  beforeEach(() => {
    resetMockRepos();
    useOnboardingStore.getState().reset();
    push.mockClear();
  });

  it('splits a typed name into first and last', () => {
    expect(splitName('  George  Smith ')).toEqual({ firstName: 'George', lastName: 'Smith' });
    expect(splitName('Mary Ann Lee')).toEqual({ firstName: 'Mary', lastName: 'Ann Lee' });
    expect(splitName('Cher')).toEqual({ firstName: 'Cher', lastName: '' });
  });

  describe('ONB 01 · name', () => {
    it('starts from the account name, fills the card, and continues on Enter', async () => {
      const user = userEvent.setup();
      renderStep('/onboarding', <NameStepScreen />);

      expect(screen.getByText('About you · 1 of 4')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Skip for now' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Back/ })).not.toBeInTheDocument();
      expect(screen.getByText('WELCOME TO NEXTKIN', { exact: false })).toBeInTheDocument();

      const field = await screen.findByLabelText('Your name', {}, wait);
      await waitFor(() => expect(field).toHaveValue('George Smith'), wait);
      expect(within(row('Name')).getByText('George Smith')).toBeInTheDocument();
      expect(
        within(row('Goal')).getByRole('img', { name: 'Not answered yet' }),
      ).toBeInTheDocument();

      await user.click(field);
      await user.keyboard('{Enter}');
      expect(push).toHaveBeenCalledWith('/onboarding/goal');
    });

    it('cannot continue without a name, and saves a changed one to the account', async () => {
      const user = userEvent.setup();
      renderStep('/onboarding', <NameStepScreen />);
      const field = await screen.findByLabelText('Your name', {}, wait);
      await waitFor(() => expect(field).toHaveValue('George Smith'), wait);

      await user.click(screen.getByRole('button', { name: 'Clear your name' }));
      expect(continueButton()).toBeDisabled();
      expect(
        within(row('Name')).getByRole('img', { name: 'Not answered yet' }),
      ).toBeInTheDocument();

      await user.type(field, 'Georgina Smythe');
      await user.click(continueButton());
      expect(push).toHaveBeenCalledWith('/onboarding/goal');
      await waitFor(
        async () =>
          expect(await repos.user.getCurrentUser()).toMatchObject({
            firstName: 'Georgina',
            lastName: 'Smythe',
          }),
        wait,
      );
    });

    it('still works when the account fails to load: the field just starts empty', async () => {
      const user = userEvent.setup();
      renderStep('/onboarding', <NameStepScreen />, 'error');
      const field = await screen.findByLabelText('Your name', {}, { timeout: SETTLE_MS.error * 2 });
      expect(field).toHaveValue('');
      await user.type(field, 'George');
      expect(continueButton()).toBeEnabled();
    });
  });

  describe('ONB 02 · goal', () => {
    it('greets by name, needs a goal, and leads the desired roles with the role typed', async () => {
      const user = userEvent.setup();
      useOnboardingStore.setState({ name: 'George Smith' });
      renderStep('/onboarding/goal', <GoalStepScreen />);

      expect(screen.getByText('About you · 2 of 4')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Skip for now' })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /Back/ })).toHaveAttribute('href', '/onboarding');
      expect(
        screen.getByRole('heading', { level: 1, name: 'Nice to meet you, George!' }),
      ).toBeInTheDocument();
      expect(screen.getByText('What are you aiming for?')).toBeInTheDocument();

      const goals = screen.getByRole('radiogroup', { name: 'Your goal' });
      expect(within(goals).getAllByRole('radio')).toHaveLength(4);
      expect(continueButton()).toBeDisabled();

      await user.click(within(goals).getByText('Move to a better role'));
      expect(within(goals).getByRole('radio', { name: /Move to a better role/ })).toBeChecked();
      await user.type(screen.getByLabelText('The role you want'), 'Lead UX Designer');
      expect(within(row('Goal')).getByText('Better role · Lead UX Designer')).toBeInTheDocument();

      // Let the profile load, so Continue has the roles to put this one in front of.
      await act(() => new Promise((resolve) => setTimeout(resolve, SETTLE_MS.normal)));
      await user.click(continueButton());
      expect(push).toHaveBeenCalledWith('/onboarding/experience');
      await waitFor(async () => {
        const { preferences } = await repos.profile.getProfile();
        expect(preferences.desiredRoles[0]).toBe('Lead UX Designer');
        expect(preferences.careerGoal).toBe('better_role');
      }, wait);
    });

    it('starts from a goal saved before', async () => {
      await repos.profile.updatePreferences({ careerGoal: 'new_field' });
      renderStep('/onboarding/goal', <GoalStepScreen />);
      await waitFor(
        () => expect(screen.getByRole('radio', { name: /Switch to a new field/ })).toBeChecked(),
        wait,
      );
      expect(within(row('Goal')).getByText('New field')).toBeInTheDocument();
      expect(continueButton()).toBeEnabled();
    });
  });

  describe('ONB 03 · experience', () => {
    it('starts from the profile and saves the job title as the headline', async () => {
      const user = userEvent.setup();
      renderStep('/onboarding/experience', <ExperienceStepScreen />);
      const profile = await repos.profile.getProfile();

      const title = await screen.findByLabelText('Your current or last job title', {}, wait);
      await waitFor(() => expect(title).toHaveValue(profile.headline), wait);
      const bands = screen.getByRole('radiogroup', { name: 'Your experience' });
      expect(within(bands).getAllByRole('radio')).toHaveLength(5);
      expect(within(bands).getByRole('radio', { checked: true })).toBeInTheDocument();

      await user.click(within(bands).getByText('6–10 years'));
      await user.clear(title);
      await user.type(title, 'Senior UX Designer');
      expect(
        within(row('Experience')).getByText('6–10 yrs · Senior UX Designer'),
      ).toBeInTheDocument();

      await user.click(continueButton());
      expect(push).toHaveBeenCalledWith('/onboarding/resume');
      await waitFor(async () => {
        const saved = await repos.profile.getProfile();
        expect(saved.headline).toBe('Senior UX Designer');
        expect(saved.preferences.experienceBand).toBe('6_10');
        // A band is not a count: the years stay as they were.
        expect(saved.yearsExperience).toBe(profile.yearsExperience);
      }, wait);
    });
  });
});
