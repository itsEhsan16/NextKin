import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createQueryClient } from '@/data/queries';
import { mockStore, repos, resetMockRepos } from '@/data/repos';
import { CopiedLinkHost, useHomeStore } from '@/features/home';
import { markAsked, useCopiedJobLink, wasAsked } from '@/features/home/hooks/useCopiedJobLink';
import { readClipboardLink, storage } from '@/lib';

const mockPush = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  // Home is in view for the whole test: the focus effect runs as a mount effect.
  useFocusEffect: (effect: () => void | (() => void)) =>
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
  Link: ({ children }: PropsWithChildren) => children,
}));

jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  readClipboardLink: jest.fn(),
}));

const mockReadClipboard = readClipboardLink as jest.MockedFunction<typeof readClipboardLink>;

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const SWIGGY = 'https://careers.swiggy.com/jobs/senior-product-designer-4821';
const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

async function renderWithClient(ui: ReactElement) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

async function openWith(url: string) {
  // Set before the first render, outside act: the host reads it as Home would have left it.
  useHomeStore.getState().foundCopiedLink(url);
  await renderWithClient(<CopiedLinkHost />);
}

function ClipboardCheck() {
  useCopiedJobLink();
  return null;
}

describe('TAILOR 00c — copied job link', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockReadClipboard.mockReset();
    storage.set('home.copiedJobLinksAsked', []);
    useHomeStore.setState({ copiedLink: null, copiedLinkPhase: 'closed' });
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('opens once the link names a job, then tailors on the job it adds to Saved jobs', async () => {
    await openWith(SWIGGY);
    // Not before the link is read: a dialog with nothing to name would be a guess.
    expect(screen.queryByText('Found a job link you copied')).toBeNull();
    await settle();

    expect(screen.getByText('Found a job link you copied')).toBeOnTheScreen();
    expect(screen.getByText('Want a resume made for this job?')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Senior Product Designer at Swiggy, careers.swiggy.com/jobs/senior-product-designer-4821',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('We only check when you open NextKin.')).toBeOnTheScreen();
    expect(screen.queryByText(/Settings/)).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Tailor my resume to it')));
    await settle();

    const added = mockStore.state.jobs.find((job) => job.sourceUrl === SWIGGY);
    expect(added?.isSaved).toBe(true);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/tailor',
      params: { jobId: added?.id },
    });
    expect(useHomeStore.getState().copiedLinkPhase).toBe('closed');
  });

  it('just saves the job, and says so', async () => {
    await openWith(SWIGGY);
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('Just save the job')));
    await settle();

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockStore.state.jobs.some((job) => job.sourceUrl === SWIGGY && job.isSaved)).toBe(true);
    expect(screen.getByText('Saved to your jobs')).toBeOnTheScreen();
  });

  it('adds nothing on Not now, and does not ask again', async () => {
    const before = mockStore.state.jobs.length;
    await openWith(SWIGGY);
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('Not now')));
    await settle();

    expect(useHomeStore.getState().copiedLinkPhase).toBe('closed');
    expect(mockStore.state.jobs).toHaveLength(before);
    expect(screen.queryByText('Found a job link you copied')).toBeNull();
  });

  it('never asks about a link that cannot be read', async () => {
    await openWith('https://careers.blocked-site.example/jobs/designer-1');
    await settle();

    expect(screen.queryByText('Found a job link you copied')).toBeNull();
    expect(useHomeStore.getState().copiedLinkPhase).toBe('closed');
  });

  it('keeps the dialog up with the reason when the job cannot be added', async () => {
    jest.spyOn(repos.jobs, 'importFromLink').mockRejectedValueOnce(new Error('offline'));
    await openWith(SWIGGY);
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('Just save the job')));
    await settle();

    expect(
      screen.getByText("We couldn't add that job. Check your connection and try again."),
    ).toBeOnTheScreen();
    expect(useHomeStore.getState().copiedLinkPhase).toBe('open');
  });

  it('hands Home a job link it has not asked about, once', async () => {
    mockReadClipboard.mockResolvedValue(SWIGGY);
    await renderWithClient(<ClipboardCheck />);
    await settle(0);

    expect(useHomeStore.getState().copiedLink).toBe(SWIGGY);
    expect(wasAsked(SWIGGY)).toBe(true);
  });

  it('leaves Home alone for a link already asked about, or anything that is not a job link', async () => {
    markAsked(SWIGGY);
    mockReadClipboard.mockResolvedValueOnce(SWIGGY);
    await renderWithClient(<ClipboardCheck />);
    await settle(0);
    expect(useHomeStore.getState().copiedLink).toBeNull();

    await cleanup();
    mockReadClipboard.mockResolvedValueOnce('https://www.youtube.com/watch?v=abc');
    await renderWithClient(<ClipboardCheck />);
    await settle(0);
    expect(useHomeStore.getState().copiedLink).toBeNull();
  });
});
