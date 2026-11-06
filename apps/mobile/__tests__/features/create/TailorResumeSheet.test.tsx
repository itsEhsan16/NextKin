import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { Job } from '@/data/models';
import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { TailorResumeSheetBody } from '@/features/create/components/TailorResumeSheet';
import { pickDocument } from '@/lib';

jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  pickDocument: jest.fn(),
}));

const pick = pickDocument as jest.MockedFunction<typeof pickDocument>;
const onCompare = jest.fn();
const onClose = jest.fn();
const clients: QueryClient[] = [];

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const JOB = { id: 'job_stripe', title: 'Senior Product Designer', company: 'Stripe' } as Job;

/** Rows enter on FadeInDown; the Reanimated mock leaves those at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: a list in well under a second, a parse in up to 2.2s. */
const settle = (ms = 2500) => act(() => jest.advanceTimersByTimeAsync(ms));

async function renderSheet(selectedResumeId?: string, onStartFromNothing?: () => void) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <TailorResumeSheetBody
          job={JOB}
          selectedResumeId={selectedResumeId}
          onClose={onClose}
          onCompare={onCompare}
          onStartFromNothing={onStartFromNothing}
        />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await settle();
}

const press = (label: string | RegExp) =>
  act(async () => void fireEvent.press(screen.getByLabelText(label, shown)));

const compare = () => press('Compare with this job');

describe('TailorResumeSheet (TAILOR 01 / 01b / 01c — 606:2, 606:229, 608:510)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    pick.mockReset();
    onCompare.mockClear();
    onClose.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('lists the resumes with the board copy and pre-picks the base', async () => {
    await renderSheet();

    expect(
      screen.getByRole('header', { name: 'Which resume should we tailor?' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('For Senior Product Designer at Stripe')).toBeOnTheScreen();
    expect(screen.getByText('ON NEXTKIN', shown)).toBeOnTheScreen();
    expect(screen.getByText('FROM YOUR PHONE', shown)).toBeOnTheScreen();
    expect(screen.getByText('Base resume · 3 pages · Updated 2 days ago', shown)).toBeOnTheScreen();
    expect(screen.getByText('For Google · Updated 2 days ago', shown)).toBeOnTheScreen();
    expect(screen.getByText('For Razorpay · Updated last week', shown)).toBeOnTheScreen();
    // Cover letters are not tailored.
    expect(screen.queryByText('Stripe cover letter', shown)).toBeNull();

    expect(screen.getByLabelText(/^Product Designer, /, shown)).toBeSelected();

    await compare();
    expect(onCompare).toHaveBeenCalledWith('res_base');
  });

  it('honours a pre-pick and lets the reader pick another', async () => {
    await renderSheet('res_5');
    expect(screen.getByLabelText(/^Razorpay UX, /, shown)).toBeSelected();

    await press(/^UX Designer Resume, /);
    await compare();
    expect(onCompare).toHaveBeenCalledWith('res_1');
  });

  it('reads an upload, moves it to the top and compares the resume it created', async () => {
    pick.mockResolvedValue({ name: 'George_Smith_Resume.pdf', uri: 'file:///tmp/george.pdf' });
    await renderSheet();

    await press('Upload a resume');
    expect(screen.getByText('Reading your file…', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Compare with this job', shown)).toBeDisabled();

    await settle();
    expect(screen.getByText('Uploaded just now', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Upload a different file', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^George_Smith_Resume\.pdf, /, shown)).toBeSelected();

    await compare();
    const [id] = onCompare.mock.calls[0] as [string];
    expect(id).toMatch(/^res_/);
    expect(id).not.toBe('res_base');
  });

  it('keeps an unreadable file in the sheet with Try another, and the CTA off', async () => {
    pick.mockResolvedValue({ name: 'Resume_scan.pdf', uri: 'file:///tmp/scan.pdf' });
    await renderSheet();

    await press('Upload a resume');
    await settle();

    expect(screen.getByText("We couldn't read this file", shown)).toBeOnTheScreen();
    expect(
      screen.getByText(
        'It may be a scan. Use a text PDF or DOCX, or pick a resume below.',
        shown,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Compare with this job', shown)).toBeDisabled();

    // A NextKin resume is still one tap away.
    await press(/^Product Designer, /);
    await compare();
    expect(onCompare).toHaveBeenCalledWith('res_base');

    // Try another opens the picker again.
    pick.mockResolvedValue(null);
    await press('Try another');
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it('shows an error with retry when the library fails', async () => {
    useMockModeStore.setState({ mode: 'error' });
    await renderSheet();

    expect(screen.getByText("Couldn't load your resumes", shown)).toBeOnTheScreen();
    // Upload still works without the library.
    expect(screen.getByLabelText('Upload a resume', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Compare with this job', shown)).toBeDisabled();
  });

  it('offers only the upload row when nothing is on NextKin', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    await renderSheet();

    expect(screen.queryByText('ON NEXTKIN', shown)).toBeNull();
    expect(screen.getByLabelText('Upload a resume', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Compare with this job', shown)).toBeDisabled();
  });

  it('offers upload or start from nothing when the library is empty (ZERO 00b)', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const start = jest.fn();
    await renderSheet(undefined, start);

    expect(screen.getByRole('header', { name: 'You don’t have a resume yet' })).toBeOnTheScreen();
    expect(
      screen.getByText('Pick how to start. Both come back to this Stripe job.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Every guess in the draft is marked for you to check.')).toBeTruthy();
    expect(screen.queryByLabelText('Compare with this job', shown)).toBeNull();

    await press('Start from nothing');
    expect(start).toHaveBeenCalledTimes(1);

    // An upload carries on in the Tailor sheet, around the file.
    pick.mockResolvedValueOnce({ name: 'George_Resume.pdf', uri: 'file:///george.pdf' });
    await press('Upload a resume');
    await settle();
    expect(screen.getByLabelText('Compare with this job', shown)).toBeOnTheScreen();
  });
});
