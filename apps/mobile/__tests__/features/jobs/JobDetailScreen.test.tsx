import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore, type MockMode } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { JobDetailScreen } from '@/features/jobs';

const mockPush = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderDetail(mode: MockMode = 'normal', id = 'job_stripe') {
  useMockModeStore.setState({ mode });
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <JobDetailScreen id={id} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** The accordion toggle is plain state; flush it before asserting on the new tree. */
const press = (label: string) =>
  act(async () => void fireEvent.press(screen.getByLabelText(label)));

describe('JobDetailScreen (JOBS 05 — 1:830)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    // See JobsScreen.test: a late request during teardown wedges React's act queue on real timers.
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('renders the hero, match card and company profile with the artboard copy', async () => {
    await renderDetail();

    expect(
      await screen.findByRole('header', { name: 'Senior Product Designer' }),
    ).toBeOnTheScreen();
    // Redrawn as 443:2: the company sits beside its logo with a verified badge, and the place
    // gets its own line rather than a dot-joined meta string.
    expect(screen.getByLabelText('Verified company')).toBeOnTheScreen();
    expect(screen.getByText('Financial infrastructure · 8,000+ employees')).toBeOnTheScreen();
    expect(screen.getByText('Bengaluru')).toBeOnTheScreen();
    expect(screen.getByText('Remote')).toBeOnTheScreen();
    // The detail screen spells the unit out, and the redraw spaces the range (443:14).
    expect(screen.getByText('₹28 – 38 LPA')).toBeOnTheScreen();
    expect(screen.getByText('· Estimated')).toBeOnTheScreen();
    expect(screen.getAllByText('8,000+ employees').length).toBeGreaterThan(0);

    expect(screen.getByRole('header', { name: 'Why you match' })).toBeOnTheScreen();
    expect(screen.getByText('Compared against your base resume and profile')).toBeOnTheScreen();

    expect(screen.getByRole('header', { name: 'About the role' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'About Stripe' })).toBeOnTheScreen();
    // The company card now leads with the board's one-line description (443:65).
    expect(screen.getByText('Financial infrastructure for the internet.')).toBeOnTheScreen();
    // Visually a link, but folded into the card's own label rather than being a second stop.
    expect(screen.getByText('stripe.com', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Stripe. Financial infrastructure for the internet. · 8,000+ employees · stripe.com',
      ),
    ).toBeOnTheScreen();
  });

  it('gives an unverified company neither the badge nor a tagline', async () => {
    // Linear is 51–200 people: not one of the big, verified companies. Its company card goes
    // straight from the name to size and website.
    await renderDetail('normal', 'job_linear');
    await screen.findByRole('header', { name: 'About Linear' });

    expect(screen.queryByLabelText('Verified company')).toBeNull();
    expect(screen.queryByText('Developer tools')).toBeNull();
    expect(screen.getByLabelText(/^Linear. 51–200 employees · /)).toBeOnTheScreen();
  });

  it('announces each match criterion with its state, not just a glyph', async () => {
    await renderDetail();
    await screen.findByRole('header', { name: 'Why you match' });

    expect(screen.getByLabelText('Met. 5+ years product design experience')).toBeOnTheScreen();
    expect(screen.getByLabelText('Missing. Fintech / payments experience')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Optional. Portfolio with case studies (preferred)'),
    ).toBeOnTheScreen();
  });

  it('expands the role description and collapses it again', async () => {
    await renderDetail();
    await screen.findByRole('header', { name: 'About the role' });

    expect(screen.getByText('Mentor two mid-level designers')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: "What we're looking for" })).toBeNull();

    await press('Show more');
    expect(screen.getByRole('header', { name: "What we're looking for" })).toBeOnTheScreen();

    await press('Show less');
    expect(screen.queryByRole('header', { name: "What we're looking for" })).toBeNull();
  });

  it('toggles the save state from the header bookmark (§183)', async () => {
    await renderDetail();
    // job_stripe ships saved, so the bookmark opens filled.
    fireEvent.press(await screen.findByLabelText('Remove from saved'));
    expect(await screen.findByLabelText('Save job')).toBeOnTheScreen();
  });

  it('tailors a resume from the sticky bar, with Apply beside it (§183)', async () => {
    await renderDetail();
    expect(await screen.findByLabelText('Apply now')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Save')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Tailor resume')));
    expect(await screen.findByText('Which resume should we tailor?')).toBeOnTheScreen();
  });

  it('opens a similar job instead of dead-ending', async () => {
    await renderDetail();
    await screen.findByRole('header', { name: 'Similar jobs' });

    // Ranking is the repo's business (covered in jobsRepo.test); here only the wiring matters.
    const cards = await screen.findAllByHintText('Opens this job');
    expect(cards.length).toBeGreaterThan(0);
    fireEvent.press(cards[0]!);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/jobs/[id]',
      params: { id: expect.not.stringMatching(/^job_stripe$/) },
    });
  });

  it('asks which resume to tailor, then opens the compare step with it (TAILOR 01)', async () => {
    await renderDetail();
    await screen.findByRole('header', { name: 'Senior Product Designer' });

    await press('Tailor your resume to this job');
    // The sheet, not a navigation: the job-first flow picks the resume over the page.
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('header', {
        name: 'Which resume should we tailor?',
        includeHiddenElements: true,
      }),
    ).toBeTruthy();

    // The base resume is pre-picked once the library arrives.
    await screen.findByText(/^Base resume · 3 pages/, { includeHiddenElements: true });
    await act(
      async () =>
        void fireEvent.press(
          screen.getByLabelText('Compare with this job', { includeHiddenElements: true }),
        ),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/tailor',
      params: { jobId: 'job_stripe', resumeId: 'res_base' },
    });
  });

  it('renders the error state with a retry', async () => {
    await renderDetail('error');

    expect(
      await screen.findByText("Couldn't load this job", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
  }, 25000);
});
