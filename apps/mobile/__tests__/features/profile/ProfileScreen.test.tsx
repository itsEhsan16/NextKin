import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
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
    expect(screen.getByLabelText('87 avg ats score')).toBeOnTheScreen();

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

    // — Groups with the artboard row values —
    for (const title of ['CAREER PROFILE', 'JOB PREFERENCES', 'SETTINGS', 'SUPPORT', 'ACCOUNT']) {
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    }
    expect(screen.getByLabelText('Work experience, 4 roles')).toBeOnTheScreen();
    expect(screen.getByLabelText('Education, 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Skills, 12')).toBeOnTheScreen();
    expect(screen.getByLabelText('Certifications, Add')).toBeOnTheScreen();
    expect(screen.getByLabelText('Links, Portfolio, LinkedIn')).toBeOnTheScreen();
    expect(screen.getByLabelText('Desired roles, 3 of 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Locations & remote, Bengaluru · Remote')).toBeOnTheScreen();
    expect(screen.getByLabelText('Minimum salary, ₹24L')).toBeOnTheScreen();
    expect(screen.getByLabelText('Availability, Open to offers')).toBeOnTheScreen();
    expect(
      screen.getByText('Only used for matching — never shown on your resume.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Notifications, 5 categories')).toBeOnTheScreen();
    expect(screen.getByLabelText('Appearance, System')).toBeOnTheScreen();
    expect(screen.getByLabelText('Language, English')).toBeOnTheScreen();
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
    fireEvent.press(screen.getByLabelText('Appearance, System'));
    expect(useProfileStore.getState()).toMatchObject({ sheet: 'appearance', sheetOpen: true });
    fireEvent.press(screen.getByLabelText('Minimum salary, ₹24L'));
    expect(useProfileStore.getState().sheet).toBe('min-salary');
    fireEvent.press(screen.getByLabelText('Sign out'));
    expect(useProfileStore.getState().sheet).toBe('sign-out');
    fireEvent.press(screen.getByLabelText('Delete account'));
    expect(useProfileStore.getState().sheet).toBe('delete-account');
    expect(mockPush).not.toHaveBeenCalled();

    // — Undesigned flows link out to placeholders —
    fireEvent.press(screen.getByLabelText('Work experience, 4 roles'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/placeholder/[screen]',
      params: { screen: 'profile-experience' },
    });
    fireEvent.press(screen.getByLabelText('Edit profile'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/placeholder/[screen]',
      params: { screen: 'profile-edit' },
    });
    // Phase 6 made the preferences screen real.
    fireEvent.press(screen.getByLabelText('Notifications, 5 categories'));
    expect(mockPush).toHaveBeenCalledWith('/notifications/preferences');

    // — Completing a next step: the chip leaves, both meters move (LAST — it mutates) —
    fireEvent.press(screen.getByLabelText('Add skills'));
    expect(
      await screen.findByRole('header', { name: 'Profile 86% complete' }, { timeout: 10000 }),
    ).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByLabelText('Add skills')).toBeNull());
    // The identity ring reads the same completeness.
    expect(screen.getByLabelText('Profile 86% complete')).toBeOnTheScreen();
    expect(screen.getByLabelText('Set salary range')).toBeOnTheScreen();
  }, 60000);
});
