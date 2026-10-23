import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createQueryClient } from '@/data/queries';
import { repos, resetMockRepos } from '@/data/repos';
import { BuildReviewScreen } from '@/features/create';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: mockReplace,
    dismissTo: jest.fn(),
    setParams: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

/** BUILD 04's own example: four of five skills on the profile, Fintech missing. */
async function seedDraft(): Promise<string> {
  const extracted = repos.jd.extract({ source: 'link', url: 'https://cred.club/careers/senior' });
  await settle();
  const { id } = await extracted;
  const updated = repos.jd.update(id, {
    title: 'Senior Product Designer',
    company: 'CRED',
    location: 'Bengaluru',
    requiredSkills: ['Design systems', 'Figma', 'Prototyping', 'User research'],
    preferredSkills: ['Fintech'],
  });
  await settle();
  await updated;
  return id;
}

async function renderReview(jdId: string) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <BuildReviewScreen jdId={jdId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('BuildReviewScreen (BUILD 04)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    [mockPush, mockReplace, mockBack].forEach((mock) => mock.mockClear());
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shows the job as read, what it asks for, and nothing measured yet', async () => {
    const jdId = await seedDraft();
    await renderReview(jdId);
    expect(screen.getByText('Add the job — we read it')).toBeOnTheScreen();
    expect(screen.getByLabelText('Loading the job')).toBeOnTheScreen();
    await settle();

    expect(screen.getByText('cred.club/careers/senior')).toBeOnTheScreen();
    expect(screen.getByText('Senior Product Designer')).toBeOnTheScreen();
    expect(screen.getByText('CRED · Bengaluru')).toBeOnTheScreen();
    expect(screen.getByText('What the job asks for · 5 things')).toBeOnTheScreen();
    expect(screen.getByText('Figma')).toBeOnTheScreen();
    expect(screen.getByText('Fintech')).toBeOnTheScreen();
    expect(screen.getByText('Next, we compare these with your profile.')).toBeOnTheScreen();
    // The comparison, and what a build costs, come on BUILD 04b.
    expect(screen.queryByText(/on your profile$/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/resume builds this month/)).not.toBeOnTheScreen();
  });

  it('opens the JD review from the pencil and goes back to change the job', async () => {
    const jdId = await seedDraft();
    await renderReview(jdId);
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('Edit the job details')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/jd-review',
      params: { draftId: jdId },
    });
    await act(async () => fireEvent.press(screen.getByLabelText('Change')));
    expect(mockBack).toHaveBeenCalled();
  });

  it('compares the read job with the profile, spending nothing', async () => {
    const startSpy = jest.spyOn(repos.generations, 'start');
    const jdId = await seedDraft();
    await renderReview(jdId);
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('Compare with my profile')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/build/compare',
      params: { jdId },
    });
    expect(startSpy).not.toHaveBeenCalled();
  });
});
