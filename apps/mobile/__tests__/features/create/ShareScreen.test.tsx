import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import { createQueryClient } from '@/data/queries';
import { repos, resetMockRepos } from '@/data/repos';
import { ShareHost, ShareScreen } from '@/features/create';
import { useShareStore } from '@/features/create/shareStore';
import { takeSharedText } from '@/lib';

import { redirectSystemPath } from '../../../app/+native-intent';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useRootNavigationState: () => ({ key: 'root' }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const shown = { includeHiddenElements: true } as const;
const payloads = Sharing.getSharedPayloads as jest.Mock;
const settle = (ms = 4000) => act(() => jest.advanceTimersByTimeAsync(ms));
const DRAFT = { id: 'jd_1' } as Awaited<ReturnType<typeof repos.jd.extract>>;

async function mount(text: string | null) {
  useShareStore.setState({ text });
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <ShareScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const unreadable = () =>
  Object.assign(new Error('This site doesn’t let us read its pages.'), { code: 'UNREADABLE_LINK' });

describe('sharing a job in (toreview §147.4)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockReplace.mockClear();
    payloads.mockReturnValue([]);
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useShareStore.setState({ text: null });
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('reads a shared link straight away and opens the review', async () => {
    const extract = jest.spyOn(repos.jd, 'extract').mockResolvedValue(DRAFT);
    await mount('https://jobs.lever.co/acme/1');
    expect(screen.getByLabelText('Reading the job…')).toBeOnTheScreen();
    await settle();
    expect(extract).toHaveBeenCalledWith({ source: 'link', url: 'https://jobs.lever.co/acme/1' });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/create/build/review',
      params: { jdId: 'jd_1' },
    });
  });

  it('sends a refused LinkedIn link to the paste box, saying whose rule it is', async () => {
    jest.spyOn(repos.jd, 'extract').mockRejectedValue(unreadable());
    await mount('https://www.linkedin.com/jobs/view/1');
    await settle();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/create/build/add',
      params: expect.objectContaining({
        mode: 'paste',
        notice: 'LinkedIn doesn’t let us read its pages. Copy the job text and paste it here.',
      }),
    });
  });

  it('uses the server’s words for any other site that refuses', async () => {
    jest.spyOn(repos.jd, 'extract').mockRejectedValue(unreadable());
    await mount('https://careers.example.com/1');
    await settle();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/create/build/add',
      params: expect.objectContaining({ notice: 'This site doesn’t let us read its pages.' }),
    });
  });

  it('offers a retry when the read fails for another reason', async () => {
    const extract = jest
      .spyOn(repos.jd, 'extract')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(DRAFT);
    await mount('https://jobs.lever.co/acme/1');
    await settle();
    expect(screen.getByText("Couldn't read that job")).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Try again', shown)));
    await settle();
    expect(extract).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenCalled();
  });

  it('says so when what was shared can’t be a job', async () => {
    await mount('look at this');
    expect(screen.getByText('That doesn’t look like a job')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Add a job', shown)));
    expect(mockReplace).toHaveBeenCalledWith('/create/build/add');
  });

  it('takes a share once, and clears it from the phone', () => {
    payloads.mockReturnValue([{ value: ' https://jobs.lever.co/acme/1 ' }]);
    expect(takeSharedText()).toBe('https://jobs.lever.co/acme/1');
    expect(Sharing.clearSharedPayloads).toHaveBeenCalled();
    payloads.mockReturnValue([]);
    expect(takeSharedText()).toBeNull();
  });

  it('routes a waiting share to the reader on opening', async () => {
    payloads.mockReturnValue([{ value: 'https://jobs.lever.co/acme/1' }]);
    await render(<ShareHost />);
    expect(useShareStore.getState().text).toBe('https://jobs.lever.co/acme/1');
    expect(mockPush).toHaveBeenCalledWith('/share');
  });

  it('lands a share’s system URL on Home, and leaves other links alone', () => {
    const system = 'nextkin://expo-sharing?dataUrl=1';
    expect(redirectSystemPath({ path: system, initial: true })).toBe('/');
    expect(redirectSystemPath({ path: 'nextkin://jobs/1', initial: false })).toBe('nextkin://jobs/1');
    expect(redirectSystemPath({ path: '/applications/1', initial: false })).toBe('/applications/1');
  });
});
