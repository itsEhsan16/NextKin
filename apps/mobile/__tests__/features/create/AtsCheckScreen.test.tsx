import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { subscriptionFixture, useMockModeStore } from '@/data/mock';
import type { Generation, Subscription } from '@/data/models';
import { createQueryClient, qk } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { AtsCheckScreen } from '@/features/create';
import { atsBlocker, JD_MIN } from '@/features/create/atsCheckSetup';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: jest.fn(),
    replace: mockReplace,
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Cards enter on `FadeInDown`; the Reanimated mock leaves an entering node at opacity 0. */
const shown = { includeHiddenElements: true } as const;
const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const NORMAL_MS = 1000;
/** A parse takes up to 2.2s; extraction and the start follow one after the other. */
const PARSE_MS = 2500;

const PASTED =
  'Senior Product Designer — Acme Pay. You’ll own merchant onboarding across web and mobile, run usability tests with research, and extend our design system.';

async function renderAts(seed?: (client: QueryClient) => void) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  seed?.(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <AtsCheckScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await settle(NORMAL_MS);
  return queryClient;
}

const press = (label: string) =>
  act(async () => void fireEvent.press(screen.getByLabelText(label, shown)));

describe('atsBlocker (ATS 01)', () => {
  it('asks for the file first, then the job or enough of a description', () => {
    const base = { hasFile: true, mode: 'job' as const, hasJob: true, pasted: '' };
    expect(atsBlocker({ ...base, hasFile: false })).toBe('Upload your resume to check it.');
    expect(atsBlocker(base)).toBeUndefined();
    expect(atsBlocker({ ...base, hasJob: false })).toBe(
      'Pick a saved job, or paste a job description.',
    );
    expect(atsBlocker({ ...base, mode: 'paste', pasted: 'short' })).toMatch(/a little more/);
    expect(atsBlocker({ ...base, mode: 'paste', pasted: 'x'.repeat(JD_MIN) })).toBeUndefined();
  });
});

describe('AtsCheckScreen (ATS 01 / 01b, 645:3 / 645:49)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('starts on your base resume and the most recent saved job (§173)', async () => {
    await renderAts();

    expect(screen.getByRole('header', { name: 'Check your resume' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1 of 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Resume: Product Designer. Change', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Job: .+, Stripe\. Change$/, shown)).toBeOnTheScreen();
    expect(screen.getByText('2 of 3 checks left this month')).toBeOnTheScreen();
  });

  it('checks a resume you already have against the saved job in one tap', async () => {
    const client = await renderAts();

    await press('Check my resume');
    await settle(PARSE_MS);
    await settle(PARSE_MS);

    const started = client.getQueryData<Generation>(qk.generations.active());
    expect(started?.kind).toBe('ats_check');
    expect(started?.jobId).toBe('job_stripe');
    expect(started?.jdId).toBeDefined();
    expect(started?.sourceResumeId).toBe('res_base');
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: started?.id },
    });
  });

  it('opens the resume sheet, with upload, from Or upload a PDF', async () => {
    await renderAts();
    await press('Upload a resume instead');
    await settle(NORMAL_MS);
    expect(screen.getByLabelText('Upload a resume', shown)).toBeOnTheScreen();
  });

  it('checks against a pasted description', async () => {
    const client = await renderAts();

    await act(async () => void fireEvent.press(screen.getAllByText('Paste', shown)[0]!));
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Job description', shown), 'Too short'),
    );
    await press('Check my resume');
    expect(
      screen.getAllByText('Paste a little more of the description, a few lines at least.', shown)
        .length,
    ).toBeGreaterThan(0);

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Job description', shown), PASTED),
    );
    await press('Check my resume');
    await settle(PARSE_MS);
    await settle(PARSE_MS);

    const started = client.getQueryData<Generation>(qk.generations.active());
    expect(started?.kind).toBe('ats_check');
    expect(started?.jobId).toBeUndefined();
    expect(started?.jdId).toBeDefined();
  });

  it('replaces the button with the plans once the checks are spent', async () => {
    const spent: Subscription = {
      ...subscriptionFixture,
      usage: { ...subscriptionFixture.usage, atsChecksUsed: 3, atsChecksLimit: 3 },
    };
    await renderAts((client) => client.setQueryData(qk.user.subscription(), spent));

    expect(screen.queryByLabelText('Check my resume')).toBeNull();
    await press('See Pro plans');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/upgrade',
      params: { reason: 'ats_checks' },
    });
  });
});
