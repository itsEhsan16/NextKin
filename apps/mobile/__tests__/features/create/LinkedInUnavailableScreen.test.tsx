import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { LinkedInUnavailableScreen } from '@/features/create/screens/LinkedInUnavailableScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderScreen() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <LinkedInUnavailableScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('LinkedInUnavailableScreen (V2 §6.2 — no supported API)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
  });

  it('names the limit and offers the path that works today', async () => {
    await renderScreen();

    expect(screen.getByRole('header', { name: 'Import from LinkedIn' })).toBeOnTheScreen();
    expect(screen.getByText("LinkedIn import isn't available yet")).toBeOnTheScreen();
    // StateView hides the message from the a11y tree (the title carries it), so it is hidden here.
    expect(screen.getByText(/no public API/, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Upload a PDF instead')).toBeOnTheScreen();
    expect(screen.getByLabelText('Not now')).toBeOnTheScreen();
  });

  it('is a statement of fact, not a release date', async () => {
    await renderScreen();

    // The point of the screen is that nothing is being promised: §6.2 has no roadmap entry, so
    // the copy must not imply one.
    const copy = JSON.stringify(screen.toJSON()).toLowerCase();
    expect(copy).not.toContain('coming soon');
    expect(copy).not.toContain('soon');
    expect(copy).not.toContain('working on it');
  });

  it('sends the reader to the upload that does the same job', async () => {
    await renderScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Upload a PDF instead')));

    expect(mockPush).toHaveBeenCalledWith('/create/upload');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('lets the reader leave without taking the detour', async () => {
    await renderScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Not now')));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
