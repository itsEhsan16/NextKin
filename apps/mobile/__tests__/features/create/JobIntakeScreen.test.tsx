import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createQueryClient } from '@/data/queries';
import { repos, resetMockRepos } from '@/data/repos';
import { JobIntakeScreen } from '@/features/create';
import { isBareLink, LINK_NOT_READ } from '@/features/create/components/JobIntake';
import { useCreateStore } from '@/features/create/createStore';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn(), replace: mockReplace }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderIntake(resumeId?: string) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <JobIntakeScreen resumeId={resumeId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));
const JD = 'Senior Product Designer at Acme. Required: Figma, design systems. Fintech a plus.';

describe('JobIntakeScreen — Add a job (toreview §114)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    useCreateStore.setState({ jobSheetOpen: false });
    [mockPush, mockReplace].forEach((mock) => mock.mockClear());
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('reads a pasted JD and goes straight to Customize for it, no review step', async () => {
    const extract = jest.spyOn(repos.jd, 'extract');
    await renderIntake('res_base');
    expect(screen.getByLabelText('Analyze job')).toBeDisabled();

    await act(async () => fireEvent.press(screen.getByLabelText(/^Paste the description/)));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Job description'), JD));
    await act(async () => fireEvent.press(screen.getByLabelText('Analyze job')));
    await settle();

    expect(extract).toHaveBeenCalledWith({ source: 'paste', text: JD });
    const draftId = (await extract.mock.results[0]?.value)?.id;
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/create/tailor',
      params: { jdId: draftId, resumeId: 'res_base' },
    });
    expect(mockPush).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/create/jd-review' }),
    );
  });

  it('says a pasted link cannot be read and asks for the text', async () => {
    await renderIntake();
    await act(async () => fireEvent.press(screen.getByLabelText(/^Paste the description/)));
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Job description'), 'https://jobs.example.com/1'),
    );
    expect(screen.getByText(LINK_NOT_READ)).toBeOnTheScreen();
    expect(screen.getByLabelText('Analyze job')).toBeDisabled();
    expect(isBareLink('www.example.com/job')).toBe(true);
    expect(isBareLink(JD)).toBe(false);
  });
});
