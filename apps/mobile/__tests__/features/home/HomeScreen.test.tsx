import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore, type MockMode } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { HomeScreen } from '@/features/home';
import { CreateSheetProvider } from '@/navigation';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderHome(mode: MockMode = 'normal') {
  useMockModeStore.setState({ mode });
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <CreateSheetProvider>
          <HomeScreen />
        </CreateSheetProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** Mock repos resolve on (fake) timers: "normal" ≤ 900ms; "error" = 600ms + 2s back-off + 600ms. */
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
const EMPTY_MS = 600;
const ERROR_MS = 3500;

describe('HomeScreen (DESIGN 2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockNavigate.mockClear();
  });

  afterEach(async () => {
    // Flush in-flight mock requests BEFORE unmounting: a late React Query update during
    // teardown starts an act() scope that overlaps the next test's, wedging React's act queue.
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('shows the skeleton first, then the dashboard with Figma copy', async () => {
    await renderHome();
    expect(screen.getByLabelText('Loading home')).toBeOnTheScreen();

    await settle(NORMAL_MS);

    expect(screen.getByText('George')).toBeOnTheScreen();
    expect(screen.getByText('Build better.\nLand faster.')).toBeOnTheScreen();
    expect(screen.getByText('Quick Start')).toBeOnTheScreen();
    expect(screen.getByText('Build Resume')).toBeOnTheScreen();
    expect(screen.getByText('Top Job Matches')).toBeOnTheScreen();

    expect(screen.getByText('Google')).toBeOnTheScreen();
    expect(screen.getByText('98%')).toBeOnTheScreen();
    expect(screen.getByText('Lead UX Designer')).toBeOnTheScreen();
    expect(screen.getByText('80+ applied')).toBeOnTheScreen();

    expect(screen.getByText('UX Designer Resume')).toBeOnTheScreen();
    // Figma spells this out longhand here, unlike the compact "2d ago" on job cards.
    expect(screen.getByText('Last updated 2 days ago')).toBeOnTheScreen();
    expect(screen.getByText('Timeline Valid')).toBeOnTheScreen();

    expect(screen.getByText('12 Resumes')).toBeOnTheScreen();
    expect(screen.getByText('24 Activities')).toBeOnTheScreen();
    expect(screen.getByText('18 Saved')).toBeOnTheScreen();
  });

  it('routes taps: Find Jobs → Jobs tab, bell → notifications placeholder', async () => {
    await renderHome();
    await settle(NORMAL_MS);

    await act(async () => fireEvent.press(screen.getByLabelText('Find Jobs')));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/jobs');

    await act(async () => fireEvent.press(screen.getByLabelText('Notifications, unread')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/placeholder/[screen]',
      params: { screen: 'notifications' },
    });
  });

  it('renders section-level empty states in "empty" mock mode', async () => {
    await renderHome('empty');
    await settle(EMPTY_MS);

    expect(screen.getByText('No matches yet')).toBeOnTheScreen();
    expect(screen.getByText('No resume yet')).toBeOnTheScreen();
  });

  it('renders the page-level error state with retry in "error" mock mode', async () => {
    await renderHome('error');
    await settle(ERROR_MS);

    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
  });
});
