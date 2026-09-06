import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { ContactScreen } from '@/features/support';
import { CONTACT_ERROR_MESSAGE } from '@/features/support/contactForm';

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

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** The account query retries once, and react-query waits between the two attempts. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(5000));

describe('ContactScreen — the account could not be read (V2 §7.14)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockBack.mockClear();
    useMockModeStore.setState({ mode: 'error' });
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('will not offer a form that cannot say where the reply goes', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <ContactScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    await settle();

    expect(screen.getByText("Couldn't load your account")).toBeOnTheScreen();
    // StateView folds its message into the title's accessible name and hides the duplicate.
    expect(
      screen.getByText(CONTACT_ERROR_MESSAGE, { includeHiddenElements: true }),
    ).toBeOnTheScreen();

    // Nothing on the page promises a reply, and there is no Send to press.
    expect(screen.queryByTestId('contact-message')).toBeNull();
    expect(screen.queryByLabelText('Send', { includeHiddenElements: true })).toBeNull();

    // The only recovery path is the one the state offers.
    await act(async () => void fireEvent.press(screen.getByLabelText('Try again')));
    await settle();
    expect(screen.getByText("Couldn't load your account")).toBeOnTheScreen();
  });
});
