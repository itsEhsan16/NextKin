import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ProfileScreen, useProfileStore } from '@/features/profile';

const mockPush = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useProfileStore.getState();

/**
 * ONE mount for the whole walk — repeated mount/unmount of query-backed screens in a single
 * file wedges React's act queue (see the test-infra note in the plan's Phase 3 status). The
 * error mode gets its own file.
 */
describe('ProfileScreen (PROFILE 01/02)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    useProfileStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('walks the identity, the cards, every group, the sheets and the next-step flow', async () => {
    useMockModeStore.setState({ mode: 'normal' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <ProfileScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — Identity block (1:2194–1:2207) —
    expect(await screen.findByText('George Smith', {}, { timeout: 10000 })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Profile' })).toBeOnTheScreen();
    expect(screen.getByText('Senior UX Designer · Bengaluru')).toBeOnTheScreen();
    expect(screen.getByLabelText('Availability: Open to offers')).toBeOnTheScreen();
    expect(screen.getByLabelText('Edit profile')).toBeOnTheScreen();
    expect(screen.getByLabelText('Profile 72% complete')).toBeOnTheScreen();

    // — Stats card (1:2208) —
    expect(screen.getByLabelText('12 applications')).toBeOnTheScreen();
    expect(screen.getByLabelText('2 interviews')).toBeOnTheScreen();
    // The average of the seeded documents' engine scores (C-11), not a fixture's 87.
    expect(screen.getByLabelText(`${mockStore.state.profile.stats.avgAtsScore} avg ats score`)).toBeOnTheScreen();

    // — Completeness card (1:2217) —
    expect(screen.getByRole('header', { name: 'Profile 72% complete' })).toBeOnTheScreen();
    expect(
      screen.getByText('Complete profiles get better matches and faster tailoring.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Add skills')).toBeOnTheScreen();
    expect(screen.getByLabelText('Set salary range')).toBeOnTheScreen();

    // — Plan row (1:2229) —
    expect(await screen.findByText('NextKin Free', {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(screen.getByText('2 of 2 resumes · 5 AI credits left')).toBeOnTheScreen();
    expect(screen.getByText('Upgrade')).toBeOnTheScreen();

    // — Groups: icon and title only; the board hides the row values (toreview.md 38.2) —
    for (const title of ['CAREER PROFILE', 'JOB PREFERENCES', 'SETTINGS', 'SUPPORT', 'ACCOUNT']) {
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    }
    expect(screen.getByLabelText('Work experience')).toBeOnTheScreen();
    expect(screen.getByLabelText('Education')).toBeOnTheScreen();
    expect(screen.getByLabelText('Skills')).toBeOnTheScreen();
    expect(screen.getByLabelText('Certifications')).toBeOnTheScreen();
    expect(screen.getByLabelText('Links')).toBeOnTheScreen();
    expect(screen.getByLabelText('Desired roles')).toBeOnTheScreen();
    expect(screen.getByLabelText('Locations & remote')).toBeOnTheScreen();
    expect(screen.getByLabelText('Minimum salary')).toBeOnTheScreen();
    expect(screen.getByLabelText('Availability')).toBeOnTheScreen();
    expect(
      screen.getByText('Only used for matching — never shown on your resume.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Notifications')).toBeOnTheScreen();
    expect(screen.getByLabelText('Appearance')).toBeOnTheScreen();
    expect(screen.getByLabelText('Language')).toBeOnTheScreen();
    for (const label of [
      'Help & FAQ',
      'Contact us',
      'Rate NextKin',
      'Terms of service',
      'Privacy policy',
      'Email & password',
      'Export my data',
      'Delete account',
      'Sign out',
    ]) {
      expect(screen.getByLabelText(label)).toBeOnTheScreen();
    }
    expect(screen.getByText('NextKin 1.0.0 (build 128)')).toBeOnTheScreen();

    // — Pickers and confirms are sheets, not routes —
    fireEvent.press(screen.getByLabelText('Appearance'));
    expect(useProfileStore.getState()).toMatchObject({ sheet: 'appearance', sheetOpen: true });
    fireEvent.press(screen.getByLabelText('Minimum salary'));
    expect(useProfileStore.getState().sheet).toBe('min-salary');
    fireEvent.press(screen.getByLabelText('Sign out'));
    expect(useProfileStore.getState().sheet).toBe('sign-out');
    fireEvent.press(screen.getByLabelText('Delete account'));
    expect(useProfileStore.getState().sheet).toBe('delete-account');
    expect(mockPush).not.toHaveBeenCalled();

    // — Phase 9F made every career-profile row a screen of its own —
    fireEvent.press(screen.getByLabelText('Work experience'));
    expect(mockPush).toHaveBeenCalledWith('/profile/experience');
    fireEvent.press(screen.getByLabelText('Edit profile'));
    expect(mockPush).toHaveBeenCalledWith('/profile/edit');
    // Phase 6 made the preferences screen real.
    fireEvent.press(screen.getByLabelText('Notifications'));
    expect(mockPush).toHaveBeenCalledWith('/notifications/preferences');

    // — The plan card opens the plans page with no reason (§85). A real press hands its event
    //   to `onPress`; it used to ride through to `openUpgrade(reason?)` and arrive as the reason. —
    mockPush.mockClear();
    fireEvent.press(screen.getByLabelText(/^NextKin Free, /), { nativeEvent: {} });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/upgrade');

    // — A next-step chip opens the editor that answers it; the tap alone does not tick it off
    //   (§85). The step leaves once its data is saved — see ProfileSheetsHost.test. —
    mockPush.mockClear();
    expect(screen.getByLabelText('Add skills')).toHaveProp('accessibilityHint', 'Opens your skills');
    fireEvent.press(screen.getByLabelText('Add skills'));
    expect(mockPush).toHaveBeenCalledWith('/profile/skills');
    fireEvent.press(screen.getByLabelText('Set salary range'));
    expect(useProfileStore.getState()).toMatchObject({ sheet: 'min-salary', sheetOpen: true });

    // Nothing was written: both chips stay, and neither meter moved.
    expect(mockStore.state.profile.completeness).toBe(0.72);
    expect(mockStore.state.profile.nextSteps.map((step) => step.id)).toEqual([
      'step_skills',
      'step_salary',
    ]);
    expect(screen.getByLabelText('Add skills')).toBeOnTheScreen();
    expect(screen.getByLabelText('Set salary range')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Profile 72% complete' })).toBeOnTheScreen();
  }, 60000);
});
