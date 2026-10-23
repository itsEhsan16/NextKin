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
import { pickDocument } from '@/lib';

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

jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  pickDocument: jest.fn(),
}));

const pick = pickDocument as jest.MockedFunction<typeof pickDocument>;

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

async function uploadCv() {
  pick.mockResolvedValueOnce({ name: 'George_Smith_CV.pdf', uri: 'file:///cv.pdf' });
  await press('Upload a resume');
  await settle(PARSE_MS);
}

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
    pick.mockReset();
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

  it('starts on the most recent saved job, with the checks left on the bar', async () => {
    await renderAts();

    expect(screen.getByRole('header', { name: 'Check your resume' })).toBeOnTheScreen();
    expect(
      screen.getByText('See how a resume made outside NextKin reads for a job.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Against this job', shown)).toBeOnTheScreen();
    expect(screen.getByText('Stripe · Bengaluru', shown)).toBeOnTheScreen();
    expect(screen.getByText('2 of 3 checks left this month')).toBeOnTheScreen();

    // Nothing to check yet: the press says what is missing and spends nothing.
    await press('Check my resume');
    expect(screen.getByText('Upload your resume to check it.')).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('reads the file on upload, then checks it against the saved job', async () => {
    const client = await renderAts();
    await uploadCv();

    expect(screen.getByText('George_Smith_CV.pdf', shown)).toBeOnTheScreen();
    expect(screen.getByText(/^Uploaded /, shown)).toBeOnTheScreen();

    await press('Check my resume');
    await settle(PARSE_MS);
    await settle(PARSE_MS);

    const started = client.getQueryData<Generation>(qk.generations.active());
    expect(started?.kind).toBe('ats_check');
    expect(started?.jobId).toBe('job_stripe');
    expect(started?.jdId).toBeDefined();
    expect(started?.sourceResumeId).toBeDefined();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/generations/[id]',
      params: { id: started?.id },
    });
  });

  it('refuses a scan in the row, before anything is spent', async () => {
    await renderAts();
    pick.mockResolvedValueOnce({ name: 'CV_scan.pdf', uri: 'file:///scan.pdf' });
    await press('Upload a resume');
    await settle(PARSE_MS);

    expect(
      screen.getByText('We couldn’t read this file. It may be a scan or a photo.', shown),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Try another', shown)).toBeOnTheScreen();
  });

  it('checks against a pasted description, and comes back to the saved job', async () => {
    const client = await renderAts();
    await uploadCv();

    await press('Or paste a job description');
    expect(
      screen.getByText('We’ll check your resume against this job description.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Against this job', shown)).toBeNull();

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Paste the job description', shown), 'Too short'),
    );
    await press('Check my resume');
    expect(
      screen.getAllByText('Paste a little more of the description, a few lines at least.', shown)
        .length,
    ).toBeGreaterThan(0);

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Paste the job description', shown), PASTED),
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
