import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { METHOD_TITLE, MethodScreen } from '@/features/create';

const mockPush = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    setParams: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderMethod() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <MethodScreen jobId="job_stripe" />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

describe('MethodScreen — "1 of 3 · Job & Resume" (toreview §234)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.useRealTimers();
  });

  it('offers the web’s four ways, Tailor recommended, and waits for a pick', async () => {
    await renderMethod();
    await settle();
    expect(screen.getByText(METHOD_TITLE)).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1 of 3, Job & Resume')).toBeOnTheScreen();
    expect(screen.getByText('For Senior Product Designer · Stripe')).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { name: /^Tailor my selected resume, recommended/ }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^Create from my profile\./ })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^Start from scratch with AI\./ })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^Upload a resume\./ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('goes to the profile against the job, or to Zero Resume', async () => {
    await renderMethod();
    await settle();
    await act(async () =>
      fireEvent.press(screen.getByRole('radio', { name: /^Create from my profile\./ })),
    );
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/build/compare',
      params: { jobId: 'job_stripe' },
    });

    await act(async () =>
      fireEvent.press(screen.getByRole('radio', { name: /^Start from scratch with AI\./ })),
    );
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/create/zero-resume',
      params: { jobId: 'job_stripe', role: 'Senior Product Designer' },
    });
  });

  it('opens the resume sheet for Tailor', async () => {
    await renderMethod();
    await settle();
    await act(async () =>
      fireEvent.press(screen.getByRole('radio', { name: /^Tailor my selected resume/ })),
    );
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    await settle(500);
    expect(screen.getByText('Which resume should we tailor?')).toBeOnTheScreen();
  });
});
