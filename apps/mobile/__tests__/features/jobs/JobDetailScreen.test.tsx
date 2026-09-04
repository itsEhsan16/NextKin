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

    expect(await screen.findByRole('header', { name: 'Senior Product Designer' })).toBeOnTheScreen();
    expect(screen.getByText('Stripe · Bengaluru · Remote')).toBeOnTheScreen();
    // The detail screen spells the unit out, unlike the "₹28–38L" on the cards.
    expect(screen.getByText('₹28–38 LPA')).toBeOnTheScreen();
    expect(screen.getByText('· est.')).toBeOnTheScreen();
    expect(screen.getByText('8,000+ employees')).toBeOnTheScreen();

    expect(screen.getByRole('header', { name: 'Why you match' })).toBeOnTheScreen();
    expect(screen.getByText('Compared against your base resume and profile')).toBeOnTheScreen();

    expect(screen.getByRole('header', { name: 'About the role' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'About Stripe' })).toBeOnTheScreen();
    expect(screen.getByText('Financial infrastructure · 8,000+ employees')).toBeOnTheScreen();
    // Visually a link, but folded into the card's own label rather than being a second stop.
    expect(screen.getByText('stripe.com', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Stripe. Financial infrastructure · 8,000+ employees · stripe.com'),
    ).toBeOnTheScreen();
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

  it('toggles the save state from the sticky bar', async () => {
    await renderDetail();
    // job_stripe ships saved, so the bar opens on "Saved".
    const saved = await screen.findByLabelText('Saved');
    expect(saved).toBeSelected();

    fireEvent.press(saved);
    expect(await screen.findByLabelText('Save')).toBeOnTheScreen();
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

  it('renders the error state with a retry', async () => {
    await renderDetail('error');

    expect(
      await screen.findByText("Couldn't load this job", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
  }, 25000);
});
