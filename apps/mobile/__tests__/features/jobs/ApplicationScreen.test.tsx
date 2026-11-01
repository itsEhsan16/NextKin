import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { Application } from '@/data/models';
import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ApplicationScreen } from '@/features/jobs';
import { interviewDayOptions } from '@/features/jobs/applicationDays';

const mockPush = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const shown = { includeHiddenElements: true } as const;
const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));
const DAY = 24 * 60 * 60 * 1000;

function seed(over: Partial<Application> = {}, daysAgo = 8): Application {
  const job = mockStore.state.jobs[0];
  if (!job) throw new Error('expected a job');
  const application: Application = {
    id: 'app_1',
    jobId: job.id,
    status: 'applied',
    appliedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    ...over,
  };
  mockStore.state.applications = [application];
  return application;
}

const current = () => {
  const [application] = mockStore.state.applications;
  if (!application) throw new Error('expected an application');
  return application;
};

async function mount(id = 'app_1') {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <ApplicationScreen id={id} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const press = (label: string | RegExp) =>
  act(async () => fireEvent.press(screen.getByLabelText(label, shown)));

describe('ApplicationScreen (toreview §147.1)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('asks about a week-old application, and "No news yet" answers it', async () => {
    seed();
    await mount();
    expect(screen.getByLabelText('Loading your application')).toBeOnTheScreen();
    await settle();

    const company = mockStore.state.jobs[0]?.company ?? '';
    expect(screen.getByText(`Any news from ${company}?`)).toBeOnTheScreen();
    await press('No news yet');
    await settle();

    expect(current().checkedAt).toBeDefined();
    expect(current().status).toBe('applied');
    expect(screen.queryByText(`Any news from ${company}?`)).toBeNull();
  });

  it('says nothing in the first week', async () => {
    seed({}, 2);
    await mount();
    await settle();
    expect(screen.queryByText(/Any news from/)).toBeNull();
    expect(screen.getByText('Where it stands')).toBeOnTheScreen();
  });

  it('records an interview and its day, and the day goes with the interview', async () => {
    seed();
    await mount();
    await settle();

    await press(/^Where it stands/);
    await press('Interview');
    await settle();
    expect(current().status).toBe('interview');
    expect(current().checkedAt).toBeDefined();

    await press(/^Interview day/);
    const [, day] = interviewDayOptions(new Date());
    if (!day) throw new Error('expected a day');
    await press(day.label);
    await settle();
    expect(current().interviewAt).toBe(day.key);

    await press(/^Where it stands/);
    await press('Offer');
    await settle();
    expect(current()).toMatchObject({ status: 'offer' });
    expect(current().interviewAt).toBeUndefined();
  });

  it('offers practice once there is an interview, from the resume it was sent with', async () => {
    seed({ resumeId: 'res_1' });
    await mount();
    await settle();
    expect(screen.queryByText('Practice for this interview')).toBeNull();

    await press(/^Where it stands/);
    await press('Interview');
    await settle();
    expect(screen.getByText('Practice for this interview')).toBeOnTheScreen();
    await press('Write practice questions');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/interview/new',
      params: { resumeId: 'res_1', roleTitle: mockStore.state.jobs[0]?.title },
    });
  });

  it('picks up the set already written for this job', async () => {
    const application = seed({ status: 'interview' });
    mockStore.state.interviewSets = [
      {
        id: 'set_1',
        title: 'Practice',
        source: 'resume',
        jobId: application.jobId,
        questions: [],
        createdAt: new Date().toISOString(),
      },
    ];
    await mount();
    await settle();
    // The card fetches the sets once the application has loaded.
    await settle();
    await press('Keep practising');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/interview/[id]', params: { id: 'set_1' } });
  });

  it('says so when the application is gone', async () => {
    seed();
    await mount('nope');
    await settle();
    expect(screen.getByText('This application is gone')).toBeOnTheScreen();
  });

  it('offers a retry when it can’t load', async () => {
    seed();
    useMockModeStore.setState({ mode: 'error' });
    await mount();
    await settle(8000);
    expect(screen.getByText("Couldn't load your application")).toBeOnTheScreen();
  });

  it('opens the job', async () => {
    seed();
    await mount();
    await settle();
    await press('View the job');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/jobs/[id]',
      params: { id: mockStore.state.jobs[0]?.id },
    });
  });
});
