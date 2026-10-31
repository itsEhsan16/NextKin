import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { repos, resetMockRepos } from '@/data/repos';
import { JdPageScreen } from '@/features/create';

const mockPush = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    navigate: jest.fn(),
    back: mockBack,
    replace: jest.fn(),
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const POSTING = `Senior Frontend Engineer

Requirements
- You bring 20+ years of experience with React.

Benefits
- Health insurance for your family
- Thirty days of paid leave

About the company
Acme builds payment software for small shops across Europe, and has done since 2015.

Compensation
$120,000 - $150,000 a year`;

const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

async function seedDraft(): Promise<string> {
  const extracted = repos.jd.extract({ source: 'paste', text: POSTING });
  await settle();
  const { id } = await extracted;
  const updated = repos.jd.update(id, {
    title: 'Senior Frontend Engineer',
    company: 'Acme',
    requiredSkills: ['React'],
    preferredSkills: [],
  });
  await settle();
  await updated;
  return id;
}

async function renderPage(draftId: string) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <JdPageScreen draftId={draftId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('JdPageScreen (the whole job as read)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    [mockPush, mockBack].forEach((mock) => mock.mockClear());
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('holds the card’s place while it loads, then reads the posting back', async () => {
    const draftId = await seedDraft();
    await renderPage(draftId);
    expect(screen.getByLabelText('Loading the job')).toBeOnTheScreen();
    await settle();

    expect(screen.getByText('Senior Frontend Engineer')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Benefits' })).toBeOnTheScreen();
    expect(screen.getByText('Thirty days of paid leave')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'About the company' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Pay' })).toBeOnTheScreen();
  });

  it('warns about what nobody could have', async () => {
    const draftId = await seedDraft();
    await renderPage(draftId);
    await settle();

    expect(screen.getByRole('header', { name: 'Requirements to double-check' })).toBeOnTheScreen();
    expect(screen.getByLabelText(/^.*React.*Looks off\./)).toBeOnTheScreen();
  });

  it('shows only what the job said: no pay section when it names no pay', async () => {
    const extracted = repos.jd.extract({
      source: 'paste',
      text: 'Designer at Acme. Work with the team on our product every day of the week.',
    });
    await settle();
    await renderPage((await extracted).id);
    await settle();

    expect(screen.queryByRole('header', { name: 'Pay' })).toBeNull();
    expect(screen.queryByRole('header', { name: 'Benefits' })).toBeNull();
    expect(screen.queryByText('Requirements to double-check')).toBeNull();
  });

  it('keeps the full text one tap away, and edits through the review', async () => {
    const draftId = await seedDraft();
    await renderPage(draftId);
    await settle();

    expect(screen.queryByText(POSTING)).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText('The full job description')));
    await settle();
    expect(screen.getByText(POSTING)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Edit the job details')));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/create/jd-review', params: { draftId } });
  });

  it('says so when the job is gone, and offers a way back', async () => {
    await renderPage('jd_gone');
    await settle(8000);

    expect(screen.getByText('We lost that job')).toBeOnTheScreen();
    // The header's Back, then the state's own.
    const back = screen.getAllByLabelText('Back').at(-1);
    if (!back) throw new Error('no way back');
    await act(async () => fireEvent.press(back));
    expect(mockBack).toHaveBeenCalled();
  });

  it('offers a retry when it could not load', async () => {
    useMockModeStore.setState({ mode: 'error' });
    await renderPage('jd_any');
    await settle(8000);

    expect(screen.getByText("Couldn't load the job")).toBeOnTheScreen();
    expect(screen.getByLabelText('Try again')).toBeOnTheScreen();
  });
});
