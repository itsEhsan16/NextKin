import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { ResumesScreen, useResumesStore } from '@/features/resumes';
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

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('Resumes first run (RESUMES 05 — 1:2061)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    useResumesStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('replaces the whole tab when the library is empty, with the three ways in', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <CreateSheetProvider>
            <ResumesScreen />
          </CreateSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    expect(
      await screen.findByText("Let's build your first resume", {}, { timeout: 10000 }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Start from what you already have — most people are done in under ten minutes.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Free plan includes 2 resumes and watermark-free PDF export — always.'),
    ).toBeOnTheScreen();
    // Only the title row survives from the normal chrome.
    expect(screen.queryByLabelText('Search resumes and letters')).toBeNull();
    expect(screen.getByLabelText('Notifications')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Upload PDF or DOCX'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/placeholder/[screen]',
      params: { screen: 'upload-resume' },
    });
    fireEvent.press(screen.getByLabelText('Import from LinkedIn'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/placeholder/[screen]',
      params: { screen: 'import-linkedin' },
    });
    fireEvent.press(screen.getByLabelText('Start with AI'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/placeholder/[screen]',
      params: { screen: 'start-from-scratch' },
    });
  }, 30000);
});
