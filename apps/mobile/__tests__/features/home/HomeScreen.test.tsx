import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore, type MockMode } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { HomeScreen, useHomeStore } from '@/features/home';
import { CreateSheetProvider } from '@/navigation';

import { insideScroller } from '../../../testSupport/scroller';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: mockNavigate,
    back: jest.fn(),
    replace: jest.fn(),
  }),
  // Home is in view for the whole test; its clipboard check (TAILOR 00c) runs on mount.
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
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
    useHomeStore.setState({ menuOpen: false });
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

    // A shortcut tile is its icon and its name. The board draws a count under each label and
    // 414:1293 restyled it, but it is deliberately not shown — the number survives only as
    // something a screen reader reads after the label.
    expect(screen.queryByText('12 Resumes')).toBeNull();
    expect(screen.queryByText('24 Activities')).toBeNull();
    expect(screen.queryByText('AI Questions')).toBeNull();
    expect(screen.queryByText('12')).toBeNull();
    expect(screen.getByLabelText('My Resumes, 12 Resumes')).toBeOnTheScreen();
    expect(screen.getByLabelText('History, 25 Activities')).toBeOnTheScreen();
    expect(screen.getByLabelText('Saved Jobs, 18 Saved')).toBeOnTheScreen();
  });

  it('routes taps: Find Jobs → Jobs tab, bell → the notifications feed', async () => {
    await renderHome();
    await settle(NORMAL_MS);

    await act(async () => fireEvent.press(screen.getByLabelText('Find Jobs')));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/jobs');

    // Phase 6 made the feed real.
    await act(async () => fireEvent.press(screen.getByLabelText('Notifications, unread')));
    expect(mockPush).toHaveBeenCalledWith('/notifications');

    // Phase 9I: the hamburger opens a sheet hosted over the tab bar, and the shortcuts that
    // stood on placeholders are real screens.
    await act(async () => fireEvent.press(screen.getByLabelText('Menu')));
    expect(useHomeStore.getState().menuOpen).toBe(true);
    await act(async () => fireEvent.press(screen.getByLabelText('History, 25 Activities')));
    expect(mockPush).toHaveBeenCalledWith('/history');
    await act(async () => fireEvent.press(screen.getByLabelText(/^Interview Prep/)));
    expect(mockPush).toHaveBeenCalledWith('/interview');
    // The redrawn board (239:361) dropped the fifth shortcut. The assistant is not orphaned by
    // that — the menu this block just opened carries it — but Home's grid no longer offers it.
    expect(screen.queryByLabelText(/^AI Assistant/)).not.toBeOnTheScreen();
    expect(mockPush).not.toHaveBeenCalledWith('/assistant');
    expect(mockPush).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/placeholder/[screen]' }),
    );
  });

  it('opens BUILD 01 from the Build Resume tile (toreview §139)', async () => {
    await renderHome();
    await settle(NORMAL_MS);

    await act(async () => fireEvent.press(screen.getByLabelText(/^Build Resume/)));
    expect(mockPush).toHaveBeenCalledWith('/create/build');
  });

  it('opens the cover letter setup from the Cover Letter tile (COVER 01, toreview §71)', async () => {
    await renderHome();
    await settle(NORMAL_MS);

    await act(async () => fireEvent.press(screen.getByLabelText(/^Cover Letter/)));
    // No job sheet first: the setup starts on the latest tailored resume and its Job row changes it.
    expect(mockPush).toHaveBeenCalledWith('/create/cover-letter');
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

  it('does not put a running generation on Home (owner, toreview 141)', async () => {
    await renderHome();
    await settle(NORMAL_MS);

    // The fixture ships one generation mid-flight.
    expect(screen.queryByText('Tailoring your resume')).toBeNull();
    expect(screen.queryByLabelText('View progress')).toBeNull();
  });

  it('pins the greeting row above the scroller', async () => {
    await renderHome();
    await settle(NORMAL_MS);

    // Both halves are needed. On its own the first would also pass if the whole page stopped
    // scrolling, which is why the cards below are asserted to still be inside the scroller.
    for (const node of [
      screen.getByRole('header', { name: 'Hi George' }),
      screen.getByLabelText('Notifications, unread'),
      screen.getByLabelText('Menu'),
    ]) {
      expect(insideScroller(node)).toBe(false);
    }

    expect(insideScroller(screen.getByText('Quick Start'))).toBe(true);
    expect(insideScroller(screen.getByText('Top Job Matches'))).toBe(true);
  });
});
