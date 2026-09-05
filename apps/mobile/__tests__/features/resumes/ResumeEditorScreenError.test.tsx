import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { ResumeEditorScreen, useResumesStore } from '@/features/resumes';
import { CreateSheetProvider } from '@/navigation';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useResumesStore.getState();
const clients: QueryClient[] = [];

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('ResumeEditorScreen error state', () => {
  beforeEach(() => {
    resetMockRepos();
    useResumesStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('renders the error state with a working retry', async () => {
    useMockModeStore.setState({ mode: 'error' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <CreateSheetProvider>
            <ResumeEditorScreen id="res_base" />
          </CreateSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    expect(
      await screen.findByText("Couldn't load this document", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    // StateView folds the message into the title's accessible label and hides the duplicate, so
    // the visible copy is queried with hidden elements included.
    expect(
      screen.getByText('Check your connection and try again.', { includeHiddenElements: true }),
    ).toBeOnTheScreen();

    // The recovery has to be reachable: the state view is deliberately not one accessible node,
    // so the button is its own element. Pressing it re-runs the query — the page drops back to
    // its skeleton and, with every request still failing, returns to the same state. Waiting for
    // that return is what proves the button is wired to a refetch rather than inert.
    await act(async () => fireEvent.press(screen.getByLabelText('Try again')));
    await waitFor(() => expect(screen.getByLabelText('Try again')).toBeOnTheScreen(), {
      timeout: 15000,
    });
  }, 30000);
});
