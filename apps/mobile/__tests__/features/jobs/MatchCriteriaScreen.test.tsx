import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import type { MatchCriterion } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { MatchCriteriaScreen } from '@/features/jobs';
import { CriteriaGroups } from '@/features/jobs/components/CriteriaGroups';
import { groupMatchCriteria, MATCH_HONESTY_NOTE } from '@/features/jobs/matchCriteria';

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

async function renderCriteria(jobId = 'job_stripe') {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <MatchCriteriaScreen jobId={jobId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** Mock repos resolve on (fake) timers — a detail read lands inside 900ms. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));

/** Rows enter on FadeInDown, which the Reanimated mock leaves at opacity 0. */
const hidden = { includeHiddenElements: true } as const;

describe('MatchCriteriaScreen (V2 §7.13 — JOBS 10)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    // Flush in-flight mock requests BEFORE unmounting, so a late React Query update does not
    // open an act() scope that overlaps the next test's.
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('pins an inert action bar under the skeleton while the job loads', async () => {
    await renderCriteria();

    expect(screen.getByLabelText('Loading match breakdown')).toBeOnTheScreen();
    // The bar owns the bottom safe-area inset, so the viewport must not resize when it lands.
    expect(screen.getByLabelText('Tailor resume to this job')).toBeDisabled();
  });

  it('shows the percentage, the band and the honesty note §7.13 requires', async () => {
    await renderCriteria();
    await settle();

    expect(screen.getByRole('header', { name: 'Why you match' })).toBeOnTheScreen();
    // job_stripe scores 0.91; the ring shows 91, converted once in matchCriteria.ts.
    expect(screen.getByLabelText('Match 91%')).toBeOnTheScreen();
    expect(screen.getByText('Strong match')).toBeOnTheScreen();

    // The one line on this screen that must never be dropped or softened.
    expect(screen.getByText(MATCH_HONESTY_NOTE)).toBeOnTheScreen();
  });

  it("groups the criteria with missing first and speaks each row's state", async () => {
    await renderCriteria();
    await settle();

    const headings = screen
      .getAllByRole('header', hidden)
      .map((node) => node.props.children)
      .filter((label) => label === 'Missing' || label === 'Met' || label === 'Optional');
    // Missing leads: it is the only group the reader can act on.
    expect(headings).toEqual(['Missing', 'Met', 'Optional']);
    // Each card says its share of every criterion (job_stripe: 1 missing, 3 met, 1 optional).
    expect(screen.getAllByText('1 of 5')).toHaveLength(2);
    expect(screen.getByText('3 of 5')).toBeOnTheScreen();

    expect(
      screen.getByLabelText('Missing. Fintech / payments experience', hidden),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Met. 5+ years product design experience', hidden),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Optional. Portfolio with case studies (preferred)', hidden),
    ).toBeOnTheScreen();
  });

  it('sends the reader to tailoring for this job from the sticky primary', async () => {
    await renderCriteria();
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText('Tailor resume to this job')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/create/tailor',
      params: { jobId: 'job_stripe' },
    });
  });

  it('offers the profile when there is no match to explain', async () => {
    // job_9 (Shopify) ships without a match, the way an unmatched listing arrives.
    await renderCriteria('job_9');
    await settle();

    expect(screen.getByText("We can't score this match yet")).toBeOnTheScreen();
    // StateView folds its message into the title's accessible name and hides the duplicate.
    expect(
      screen.getByText('Matching reads the skills and experience on your profile.', hidden),
    ).toBeOnTheScreen();
    // Nothing pretends to a number it could not compute, and the bar is gone with it.
    expect(screen.queryByLabelText('Tailor resume to this job')).toBeNull();

    await act(async () => fireEvent.press(screen.getByLabelText('Complete your profile')));
    expect(mockPush).toHaveBeenCalledWith('/profile/skills');
  });
});

describe('CriteriaGroups', () => {
  afterEach(async () => {
    await cleanup();
  });

  it("shows a criterion's evidence under its label", async () => {
    const criteria: MatchCriterion[] = [
      {
        id: 'crit_1',
        label: 'Years of experience',
        state: 'met',
        detail: 'Required: 5+ years — you have 8',
      },
    ];

    await render(<CriteriaGroups groups={groupMatchCriteria(criteria)} />);

    expect(screen.getByText('Required: 5+ years — you have 8', hidden)).toBeOnTheScreen();
    // The evidence is spoken with the row rather than as a second, orphaned stop.
    expect(
      screen.getByLabelText('Met. Years of experience. Required: 5+ years — you have 8', hidden),
    ).toBeOnTheScreen();
  });
});
