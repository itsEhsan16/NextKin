import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { useSessionStore } from '@/features/auth';
import { ProfileSheetsHost, useProfileStore } from '@/features/profile';
import {
  APPEARANCE_COMING_SOON,
  DELETE_ACCOUNT_FAILED,
  PREFERENCE_REVERTED,
} from '@/features/profile/ProfileSheetsHost';
import { storage } from '@/lib';

const stepIds = () => mockStore.state.profile.nextSteps.map((step) => step.id);

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
    // jest.setup's kv-store stands on one module-scoped Map per file that nothing resets between
    // the tests in it, so a test that signs out would otherwise leak into the ones after it.
    storage.remove('prefs.session');
    useSessionStore.setState({ status: 'signed_in' });
    useProfileStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
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

    // — Appearance is light only: System and Dark show, greyed out, until a dark design exists —
    expect(screen.getByRole('header', { name: 'Appearance' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Light')).toBeSelected();
    expect(screen.getByLabelText('System')).toBeDisabled();
    expect(screen.getByLabelText('Dark')).toBeDisabled();
    expect(screen.getAllByText(APPEARANCE_COMING_SOON)).toHaveLength(2);
    fireEvent.press(screen.getByLabelText('Dark'));
    expect(screen.getByLabelText('Light')).toBeSelected();
    expect(useProfileStore.getState().sheetOpen).toBe(true);
    fireEvent.press(screen.getByLabelText('Light'));
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

    // — A refused picker write flips back AND says so; it used to flip back in silence (§85) —
    await act(async () => useProfileStore.getState().openSheet('language'));
    expect(await screen.findByRole('header', { name: 'Language' })).toBeOnTheScreen();
    useMockModeStore.setState({ mode: 'error' });
    fireEvent.press(screen.getByLabelText('German'));
    await waitFor(
      () =>
        expect(useProfileStore.getState()).toMatchObject({
          toast: PREFERENCE_REVERTED,
          toastTone: 'error',
        }),
      { timeout: 10000 },
    );
    expect(mockStore.state.profile.preferences.language).toBe('en');
    expect(useProfileStore.getState().sheetOpen).toBe(false);
    useMockModeStore.setState({ mode: 'normal' });
    await act(async () => useProfileStore.getState().hideToast());

    // — Minimum salary offers lakh floors and can clear the preference —
    await act(async () => useProfileStore.getState().openSheet('min-salary'));
    expect(await screen.findByRole('header', { name: 'Minimum salary' })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText('₹24L')).toBeSelected(), { timeout: 10000 });
    fireEvent.press(screen.getByLabelText('No minimum'));
    await waitFor(() => expect(mockStore.state.profile.preferences.minSalary).toBeUndefined(), {
      timeout: 10000,
    });
    // Clearing the floor does not answer "Set salary range": once every write has settled, the
    // step is still there and the meter has not moved.
    await waitFor(() => expect(queryClient.isMutating()).toBe(0), { timeout: 10000 });
    expect(stepIds()).toContain('step_salary');
    expect(mockStore.state.profile.completeness).toBe(0.72);

    // — A floor that lands answers the step: the chip's data is now there (§85) —
    await act(async () => useProfileStore.getState().openSheet('min-salary'));
    await waitFor(() => expect(screen.getByLabelText('No minimum')).toBeSelected(), {
      timeout: 10000,
    });
    fireEvent.press(screen.getByLabelText('₹30L'));
    await waitFor(() => expect(stepIds()).not.toContain('step_salary'), { timeout: 10000 });
    expect(mockStore.state.profile.preferences.minSalary).toMatchObject({ min: 3_000_000 });
    expect(mockStore.state.profile.completeness).toBe(0.86);
    // The other chip is answered by its own editor, never by this one.
    expect(stepIds()).toEqual(['step_skills']);

    // — Sign out ends the session synchronously and persists it —
    await act(async () => useProfileStore.getState().openSheet('sign-out'));
    expect(await screen.findByRole('header', { name: 'Sign out?' })).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Sign out'));
    expect(useSessionStore.getState().status).toBe('signed_out');
    expect(useProfileStore.getState().sheetOpen).toBe(false);
    expect(storage.get('prefs.session')).toBe('signed_out');
    // In the app that flip takes the whole (tabs) subtree, this host included, with it; the host
    // is mounted on its own here, so put the session back and carry on in the same mount.
    await act(async () => useSessionStore.setState({ status: 'signed_in' }));

    // — A refused delete keeps the sheet up for the retry and says why (§85: it was silent) —
    await act(async () => useProfileStore.getState().openSheet('delete-account'));
    expect(await screen.findByRole('header', { name: 'Delete your account?' })).toBeOnTheScreen();
    expect(screen.getByText(/deleted for good/)).toBeOnTheScreen();
    useMockModeStore.setState({ mode: 'error' });
    fireEvent.press(screen.getByLabelText('Delete account'));
    await waitFor(
      () =>
        expect(useProfileStore.getState()).toMatchObject({
          toast: DELETE_ACCOUNT_FAILED,
          toastTone: 'error',
        }),
      { timeout: 10000 },
    );
    expect(useSessionStore.getState().status).toBe('signed_in');
    expect(useProfileStore.getState().sheetOpen).toBe(true);
    useMockModeStore.setState({ mode: 'normal' });

    // — Delete account waits for the mutation, then ends the session —
    await waitFor(() => expect(screen.getByLabelText('Delete account')).toBeEnabled());
    fireEvent.press(screen.getByLabelText('Delete account'));
    await waitFor(() => expect(useSessionStore.getState().status).toBe('signed_out'), {
      timeout: 10000,
    });
    expect(useProfileStore.getState().sheetOpen).toBe(false);
    // Removed, not set to 'signed_out': the next cold start is a fresh mock account.
    expect(storage.get('prefs.session')).toBeNull();
  }, 60000);
});
