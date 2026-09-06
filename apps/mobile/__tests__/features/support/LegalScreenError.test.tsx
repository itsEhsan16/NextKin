import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { legalFixture, useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { openExternalUrl } from '@/lib';
import { LegalScreen } from '@/features/support';

const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    back: mockBack,
    replace: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

// Partial mock, so only the side effect is replaced and the rest of @/lib stays real.
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  openExternalUrl: jest.fn(),
}));

const openMock = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>;

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Real timers here (the house error-state pattern): the query retries once with a backoff. */
describe('LegalScreen error state (V2 §8.5)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockBack.mockClear();
    openMock.mockReset();
    openMock.mockResolvedValue('done');
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('keeps the document reachable on the web when it could not be loaded', async () => {
    useMockModeStore.setState({ mode: 'error' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <LegalScreen doc="privacy" />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    expect(
      await screen.findByText("Couldn't load this document", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    // The title stays on the header, so the reader still knows which document failed.
    expect(screen.getByRole('header', { name: 'Privacy policy' })).toBeOnTheScreen();

    // §8.5 is an obligation, not a nicety: a failed fetch must not be the same thing as an
    // unreadable policy, so the canonical copy is still one press away. Two controls carry it —
    // the header action and the state's own fallback — and both go to the same address.
    const webActions = screen.getAllByLabelText('Open on the web');
    expect(webActions.length).toBeGreaterThan(1);
    for (const action of webActions) {
      openMock.mockClear();
      await act(async () => fireEvent.press(action));
      expect(openMock).toHaveBeenCalledWith(legalFixture.privacy.url);
    }

    // Try again refetches; still failing, so the state holds rather than blanking the page.
    await act(async () => fireEvent.press(screen.getByLabelText('Try again')));
    // `waitFor` around the assertion, not `findBy` then assert: the retry puts the page back
    // through its skeleton before the second failure lands, and the gap between an awaited find
    // and the next line is enough for React to commit it. Only re-running the whole assertion
    // tolerates the transient state — and it only ever showed up under full-suite load.
    await waitFor(() => expect(screen.getByText("Couldn't load this document")).toBeOnTheScreen(), {
      timeout: 15000,
    });
  }, 60000);
});
