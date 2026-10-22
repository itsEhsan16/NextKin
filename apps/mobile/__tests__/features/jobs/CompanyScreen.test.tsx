import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { CompanyScreen } from '@/features/jobs';
import { openExternalUrl } from '@/lib';

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

// Partial mock: the screen also takes `formatJobMeta`, `a11yButton` and `a11yHeader` from this
// barrel, so everything but the one call under test stays real.
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  openExternalUrl: jest.fn(),
}));

const mockOpenUrl = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>;

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Mock repos resolve on (fake) timers: 300–900ms in normal mode, and this page runs two queries. */
const settle = (ms = 2000) => act(() => jest.advanceTimersByTimeAsync(ms));

async function mount(jobId: string) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <CompanyScreen jobId={jobId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  // The job has to land before the listings query is even enabled, so advance twice.
  await settle();
  await settle();
}

describe('CompanyScreen (V2 §7.13 — JOBS 09)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
    mockOpenUrl.mockReset();
    mockOpenUrl.mockResolvedValue('done');
  });

  afterEach(async () => {
    // Flush in-flight mock requests BEFORE unmounting, so a late React Query update does not
    // open an act() scope that overlaps the next test's.
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('the partial @/lib mock replaces only openExternalUrl', () => {
    // Guard on the mock itself: if the spread ever stopped working the assertions below would
    // pass for the wrong reason, or the real browser wrapper would run inside Jest.
    const lib = jest.requireMock('@/lib') as typeof import('@/lib');
    expect(jest.isMockFunction(lib.openExternalUrl)).toBe(true);
    expect(jest.isMockFunction(lib.formatJobMeta)).toBe(false);
    expect(lib.formatJobMeta(['Stripe', undefined, 'Remote'])).toBe('Stripe · Remote');
  });

  it('leads with the company, its profile line and the hand-written About copy', async () => {
    await mount('job_stripe');

    // JOBS 09 leaves the header's title slot empty: the hero alone names the employer.
    expect(screen.getAllByRole('header', { name: 'Stripe' })).toHaveLength(1);
    expect(screen.getByText('Financial infrastructure · 8,000+ employees')).toBeOnTheScreen();

    expect(screen.getByRole('header', { name: 'About' })).toBeOnTheScreen();
    expect(
      screen.getByText(/Stripe builds the payments and financial infrastructure/),
    ).toBeOnTheScreen();

    expect(screen.getByRole('header', { name: 'Open roles at Stripe' })).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Back')));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('lists the other Stripe roles and never the one the reader came from', async () => {
    await mount('job_stripe');

    // job_1 is the other Stripe listing; job_stripe (Bengaluru) itself is deliberately excluded.
    expect(screen.getByText('San Francisco, CA')).toBeOnTheScreen();
    expect(screen.queryByText('Bengaluru')).toBeNull();
    expect(screen.getByText('1 role')).toBeOnTheScreen();
    expect(screen.queryByText('No other open roles right now')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText(/San Francisco, CA/)));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/jobs/[id]', params: { id: 'job_1' } });
  }, 60000);

  it('opens the website by host, and says so on the page when nothing can', async () => {
    await mount('job_stripe');

    // The row shows the host, not a raw address.
    const row = screen.getByLabelText('Website, stripe.com');
    expect(screen.getByText('stripe.com')).toBeOnTheScreen();

    await act(async () => fireEvent.press(row));
    expect(mockOpenUrl).toHaveBeenCalledWith('https://stripe.com');

    // A pushed screen sits above every toast host, so the failure lands on the page instead.
    mockOpenUrl.mockResolvedValue('unavailable');
    await act(async () => fireEvent.press(row));
    await settle(0);
    expect(
      await screen.findByText('Nothing on this device could open that address'),
    ).toBeOnTheScreen();
  }, 60000);

  it('says so plainly when the company has no other opening', async () => {
    // Razorpay has exactly one listing in the fixtures — a real case, not a contrived one.
    await mount('job_razorpay');

    expect(screen.getByRole('header', { name: 'Open roles at Razorpay' })).toBeOnTheScreen();
    expect(screen.getByText('No other open roles right now')).toBeOnTheScreen();
    // StateView hides its own message from the tree — the title carries both for a screen reader.
    expect(
      screen.getByText('This is the only Razorpay listing we have today.', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'No other open roles right now. This is the only Razorpay listing we have today.',
      ),
    ).toBeOnTheScreen();
  }, 60000);
});
