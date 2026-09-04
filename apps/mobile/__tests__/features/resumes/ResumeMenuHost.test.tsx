import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ResumeMenuHost, useResumesStore } from '@/features/resumes';
import { CreateSheetProvider } from '@/navigation';

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

const INITIAL = useResumesStore.getState();
const stripeDoc = () => {
  const doc = mockStore.state.resumes.find((resume) => resume.id === 'res_2');
  if (!doc) throw new Error('fixture doc res_2 missing');
  return doc;
};

/** One mount for the whole walk — see the test-infra note in the plan's Phase 3 status. */
describe('ResumeMenuHost (RESUMES 03 wiring)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    useResumesStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
  });

  it('duplicates, moves the Base flag, routes rename, and deletes only after the confirm', async () => {
    // No act(): nothing is mounted yet, and an un-awaited act scope here would swallow the
    // upcoming render's commits (the tree comes back empty).
    useResumesStore.getState().openMenu(stripeDoc());
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <CreateSheetProvider>
            <ResumeMenuHost />
          </CreateSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — Duplicate: fires the mutation and closes immediately —
    const before = mockStore.state.resumes.length;
    fireEvent.press(screen.getByLabelText('Duplicate'));
    expect(useResumesStore.getState().menuOpen).toBe(false);
    await waitFor(() => expect(mockStore.state.resumes.length).toBe(before + 1), {
      timeout: 10000,
    });
    expect(mockStore.state.resumes.some((r) => r.title === 'Stripe — Senior PD (copy)')).toBe(true);

    // — Set as base: the flag moves, never accumulates —
    await act(async () => useResumesStore.getState().openMenu(stripeDoc()));
    fireEvent.press(screen.getByLabelText('Set as base'));
    await waitFor(
      () => expect(mockStore.state.resumes.find((r) => r.id === 'res_2')?.isBase).toBe(true),
      { timeout: 10000 },
    );
    expect(
      mockStore.state.resumes.filter((r) => r.docType === 'resume' && r.isBase),
    ).toHaveLength(1);

    // — Rename has no designed screen yet: close, then the placeholder —
    await act(async () => useResumesStore.getState().openMenu(stripeDoc()));
    fireEvent.press(screen.getByLabelText('Rename'));
    expect(useResumesStore.getState().menuOpen).toBe(false);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/placeholder/[screen]',
      params: { screen: 'resume-rename' },
    });

    // — Delete goes through the inline confirm (the artboard's "Asks to confirm") —
    await act(async () => useResumesStore.getState().openMenu(stripeDoc()));
    fireEvent.press(screen.getByLabelText('Delete'));
    // Nothing deleted yet — the sheet swapped to the confirm step instead.
    expect(mockStore.state.resumes.some((r) => r.id === 'res_2')).toBe(true);
    expect(await screen.findByRole('header', { name: 'Delete this resume?' })).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Delete'));
    await waitFor(() => expect(mockStore.state.resumes.some((r) => r.id === 'res_2')).toBe(false), {
      timeout: 10000,
    });
    await waitFor(() => expect(useResumesStore.getState().menuOpen).toBe(false));
  }, 60000);
});
