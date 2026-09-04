import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ProfileSheetsHost, useProfileStore } from '@/features/profile';
import { storage } from '@/lib';
import { useAppearanceStore } from '@/theme';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const clients: QueryClient[] = [];
const INITIAL = useProfileStore.getState();

/** One mount for the whole walk — see the test-infra note in the plan's Phase 3 status. */
describe('Profile picker & confirm sheets (plan §Phase 5)', () => {
  beforeEach(() => {
    resetMockRepos();
    storage.remove('prefs.appearance');
    useAppearanceStore.setState({ preference: 'system' });
    useProfileStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
  });

  it('walks appearance, availability, minimum salary and the two confirms', async () => {
    // No act(): nothing is mounted yet, and an un-awaited act scope here would swallow the
    // upcoming render's commits (the tree comes back empty).
    useProfileStore.getState().openSheet('appearance');
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <ProfileSheetsHost />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — Appearance writes the real, persisted theme preference —
    expect(screen.getByRole('header', { name: 'Appearance' })).toBeOnTheScreen();
    expect(screen.getByText('Follows your device setting')).toBeOnTheScreen();
    expect(screen.getByLabelText('System')).toBeSelected();
    fireEvent.press(screen.getByLabelText('Dark'));
    expect(useAppearanceStore.getState().preference).toBe('dark');
    expect(storage.get('prefs.appearance')).toBe('dark');
    expect(useProfileStore.getState().sheetOpen).toBe(false);

    // — Availability writes through the profile repo —
    await act(async () => useProfileStore.getState().openSheet('availability'));
    expect(await screen.findByRole('header', { name: 'Availability' })).toBeOnTheScreen();
    // Seeded from the fixture's "Open to offers" once the profile query resolves.
    await waitFor(() => expect(screen.getByLabelText('Open to offers')).toBeSelected(), {
      timeout: 10000,
    });
    fireEvent.press(screen.getByLabelText('Not looking'));
    await waitFor(
      () => expect(mockStore.state.profile.preferences.availability).toBe('not_looking'),
      { timeout: 10000 },
    );
    expect(useProfileStore.getState().sheetOpen).toBe(false);

    // — Minimum salary offers lakh floors and can clear the preference —
    await act(async () => useProfileStore.getState().openSheet('min-salary'));
    expect(await screen.findByRole('header', { name: 'Minimum salary' })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText('₹24L')).toBeSelected(), { timeout: 10000 });
    fireEvent.press(screen.getByLabelText('No minimum'));
    await waitFor(() => expect(mockStore.state.profile.preferences.minSalary).toBeUndefined(), {
      timeout: 10000,
    });

    // — Sign out and delete account stop at a confirm sheet —
    await act(async () => useProfileStore.getState().openSheet('sign-out'));
    expect(await screen.findByRole('header', { name: 'Sign out?' })).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(useProfileStore.getState().sheetOpen).toBe(false);

    await act(async () => useProfileStore.getState().openSheet('delete-account'));
    expect(await screen.findByRole('header', { name: 'Delete your account?' })).toBeOnTheScreen();
    expect(screen.getByText(/permanently removed/)).toBeOnTheScreen();
    // There is no session to end until auth lands (plan §Phase 8): confirming just closes.
    fireEvent.press(screen.getByLabelText('Delete account'));
    expect(useProfileStore.getState().sheetOpen).toBe(false);
  }, 60000);
});
