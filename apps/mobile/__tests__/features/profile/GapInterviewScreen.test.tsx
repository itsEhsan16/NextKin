import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { GapInterviewCard, GapInterviewScreen } from '@/features/profile';

const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: mockBack, replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const shown = { includeHiddenElements: true } as const;
const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

const ROLE = {
  id: 'exp_a',
  company: 'Acme',
  title: 'Designer',
  startDate: '2020-01-01',
  endDate: '2021-01-01',
  current: false,
  skills: ['Figma'],
};

function seed(over: Partial<typeof mockStore.state.profile>) {
  mockStore.state.profile = {
    ...mockStore.state.profile,
    skills: ['Figma'],
    experiences: [ROLE],
    education: [],
    ...over,
  };
}

async function mount(page = <GapInterviewScreen />) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>{page}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const press = (label: string | RegExp) =>
  act(async () => fireEvent.press(screen.getByLabelText(label, shown)));

describe('GapInterviewScreen (toreview §146.7)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockBack.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('asks about a skill no role shows, and tags it at the role picked', async () => {
    seed({ skills: ['Figma', 'Go'] });
    await mount();
    expect(screen.getByLabelText('Loading your questions')).toBeOnTheScreen();
    await settle();

    expect(screen.getByText('1 question left')).toBeOnTheScreen();
    expect(
      screen.getByText('You list Go, but no role shows it. Where did you use it?'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Save')).toBeDisabled();

    await press('Designer at Acme');
    await press('Save');
    await settle();

    expect(mockStore.state.profile.experiences[0]).toMatchObject({
      skills: ['Figma', 'Go'],
      provenance: 'user',
    });
    expect(screen.getByText('Nothing to ask right now')).toBeOnTheScreen();
  });

  it('takes a finished year, and won’t save one that isn’t a year', async () => {
    seed({
      education: [
        { id: 'edu_a', institution: 'Uni', degree: 'BSc', startDate: '2016-01-01', current: false },
      ],
    });
    await mount();
    await settle();

    expect(screen.getByText('What year did you finish at Uni?')).toBeOnTheScreen();
    const year = screen.getByLabelText('Year');
    await act(async () => fireEvent.changeText(year, '19'));
    expect(screen.getByLabelText('Save')).toBeDisabled();

    await act(async () => fireEvent.changeText(year, '2019'));
    await press('Save');
    await settle();

    expect(mockStore.state.profile.education[0]).toMatchObject({
      endDate: '2019-12-31',
      endPrecision: 'year',
      provenance: 'user',
    });
  });

  it('lets a question go without changing a fact, and doesn’t ask it again', async () => {
    seed({ skills: ['Figma', 'Go'] });
    await mount();
    await settle();

    await press('Skip');
    await settle();

    expect(screen.getByText('Nothing to ask right now')).toBeOnTheScreen();
    expect(mockStore.state.profile.experiences[0]?.skills).toEqual(['Figma']);
    expect(mockStore.state.gapAnswers).toEqual({ 'skill_home:go': 'skip' });
    await press('Back to your profile');
    expect(mockBack).toHaveBeenCalled();
  });

  it('asks about a gap, and only keeps the reason', async () => {
    seed({
      experiences: [
        { ...ROLE, id: 'a', startDate: '2021-01-01', endDate: '2023-01-01' },
        { ...ROLE, id: 'b', startDate: '2023-08-01', endDate: '2024-01-01' },
      ],
    });
    await mount();
    await settle();

    expect(screen.getByText('What were you doing from Jan 2023 to Aug 2023?')).toBeOnTheScreen();
    await press('Studying');
    await press('Save');
    await settle();

    expect(mockStore.state.gapAnswers).toEqual({ 'date_gap:2023-01:2023-08': 'study' });
    expect(mockStore.state.profile.experiences[0]?.endDate).toBe('2023-01-01');
  });

  it('offers a role with no skills what the profile already lists, or a typed one', async () => {
    seed({ skills: ['Figma'], experiences: [{ ...ROLE, skills: [] }] });
    await mount();
    await settle();

    // Figma is also a listed skill no role shows, so tagging it here answers both questions.
    expect(screen.getByText('2 questions left')).toBeOnTheScreen();
    await press('Figma');
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Or type them'), 'Sketch, Zeplin'),
    );
    const [save] = screen.getAllByLabelText('Save');
    if (!save) throw new Error('expected the role’s card first');
    await act(async () => fireEvent.press(save));
    await settle();

    expect(mockStore.state.profile.experiences[0]?.skills).toEqual(['Figma', 'Sketch', 'Zeplin']);
    expect(screen.getByText('Nothing to ask right now')).toBeOnTheScreen();
  });

  it('offers a retry when it can’t load', async () => {
    useMockModeStore.setState({ mode: 'error' });
    await mount();
    await settle(8000);
    expect(screen.getByText("Couldn't load your questions")).toBeOnTheScreen();
  });
});

describe('GapInterviewCard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.useRealTimers();
  });

  it('counts what’s left, and opens the interview', async () => {
    seed({ skills: ['Figma', 'Go'] });
    const open = jest.fn();
    await mount(<GapInterviewCard onOpen={open} />);
    await settle();

    expect(screen.getByText('1 quick question for you')).toBeOnTheScreen();
    await press('Answer them');
    expect(open).toHaveBeenCalled();
  });

  it('draws nothing with nothing to ask', async () => {
    seed({});
    await mount(<GapInterviewCard onOpen={jest.fn()} />);
    await settle();
    expect(screen.queryByLabelText('Answer them')).toBeNull();
  });
});
