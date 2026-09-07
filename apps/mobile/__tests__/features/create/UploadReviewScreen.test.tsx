import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import type { Profile, ProfileDraft } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { UploadReviewScreen, useImportStore } from '@/features/create';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack, replace: mockReplace }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const RESUME_ID = 'res_imported';

/**
 * A parse of someone else's resume: nothing in it is already on the fixture profile, so what the
 * profile does (and does not) gain is unambiguous. The second role has no end date and is not
 * flagged current — the low-confidence rule, which starts that row switched off.
 */
const DRAFT: ProfileDraft = {
  headline: 'Lead Product Designer',
  skills: ['Service design', 'Data visualisation'],
  experiences: [
    {
      id: 'exp_a',
      company: 'Zerodha',
      title: 'Design Lead',
      startDate: '2023-01-01',
      endDate: '2024-09-01',
      current: false,
      skills: [],
    },
    {
      id: 'exp_b',
      company: 'Freelance',
      title: 'Consultant',
      startDate: '2021-04-01',
      current: false,
      skills: [],
    },
  ],
  education: [],
};

/** Rows enter on FadeInDown; the Reanimated mock leaves an entering node at opacity 0. */
const shown = { includeHiddenElements: true } as const;

/** Mock repos resolve on (fake) timers: 300–900ms in normal mode. */
const settle = (ms = 2000) => act(() => jest.advanceTimersByTimeAsync(ms));

/** The fixture profile as the repo actually holds it, read straight rather than through a query. */
const profileNow = (): Profile => JSON.parse(JSON.stringify(mockStore.state.profile)) as Profile;

async function renderReview(seed = true) {
  if (seed) useImportStore.getState().setImport({ draft: DRAFT, resumeId: RESUME_ID });
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <UploadReviewScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const press = async (label: string) =>
  act(async () => fireEvent.press(screen.getByLabelText(label, shown)));

describe('UploadReviewScreen (V2 §7.4 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    useImportStore.setState({ draft: null, resumeId: null });
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

  it('draws every parsed row and says what pressing Add would do', async () => {
    await renderReview();

    expect(screen.getByRole('header', { name: 'Check what we found' })).toBeOnTheScreen();
    expect(screen.getByText('Zerodha · Jan 2023 – Sep 2024', shown)).toBeOnTheScreen();
    expect(screen.getByText('Service design', shown)).toBeOnTheScreen();

    // The guessed row says what is wrong with it and starts REJECTED — §7.4 forbids presenting
    // an assumption as something already known.
    expect(screen.getByText('Freelance · Apr 2021 – no end date found', shown)).toBeOnTheScreen();
    expect(screen.getByLabelText('Consultant, No end date found', shown)).not.toBeChecked();
    expect(screen.getByLabelText('Design Lead', shown)).toBeChecked();

    // §7.4's promise, made on the screen where the rows are actually accepted.
    expect(
      screen.getByText('Nothing is added to your profile until you press Add.', shown),
    ).toBeOnTheScreen();

    // The count is on screen BEFORE the press, and it counts only what is switched on.
    expect(screen.getByText('Adds a headline, 1 role and 2 skills')).toBeOnTheScreen();
  });

  it('offers the upload step again when it is opened with nothing to review', async () => {
    await renderReview(false);

    expect(screen.getByText('Nothing to review')).toBeOnTheScreen();
    await press('Upload a resume');
    expect(mockPush).toHaveBeenCalledWith('/create/upload');
  });

  it('disables Add with a reason once every row is switched off, and still offers Skip', async () => {
    await renderReview();

    for (const label of [
      'Lead Product Designer',
      'Design Lead',
      'Service design',
      'Data visualisation',
    ]) {
      await press(label);
    }

    expect(screen.getByText('Nothing selected. Turn on a row to add it.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Add to profile')).toBeDisabled();
    expect(screen.getByLabelText('Skip')).not.toBeDisabled();
  });

  it('leaves the profile byte-for-byte unchanged when the review is skipped', async () => {
    await renderReview();
    const before = profileNow();

    await press('Skip');
    await settle();

    // §7.4: abandoning the review touches nothing. The document is real either way — the parse
    // already wrote it — so the skip still opens it.
    expect(profileNow()).toEqual(before);
    expect(useImportStore.getState().draft).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/resumes/[id]',
      params: { id: RESUME_ID },
    });
  });

  it('says so and changes nothing when the write fails', async () => {
    useMockModeStore.setState({ mode: 'error' });
    await renderReview();
    const before = profileNow();

    await press('Add to profile');
    await settle();

    expect(
      screen.getByText("We couldn't add those to your profile. Nothing changed — try again."),
    ).toBeOnTheScreen();
    // The optimistic write is rolled back, the draft is still here, and the press is the retry.
    expect(profileNow()).toEqual(before);
    expect(useImportStore.getState().draft).not.toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Add to profile')).not.toBeDisabled();
  });

  it('adds only the accepted rows when Add is pressed', async () => {
    await renderReview();
    const before = profileNow();

    await press('Add to profile');
    await settle();

    const after = profileNow();
    expect(after.skills).toEqual([...before.skills, 'Service design', 'Data visualisation']);
    expect(after.experiences).toHaveLength(before.experiences.length + 1);
    expect(after.experiences.at(-1)).toMatchObject({ company: 'Zerodha', title: 'Design Lead' });
    // The row that was switched off never travelled.
    expect(after.experiences.some((entry) => entry.company === 'Freelance')).toBe(false);
    expect(after.headline).toBe('Lead Product Designer');

    expect(useImportStore.getState().draft).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/resumes/[id]',
      params: { id: RESUME_ID },
    });
  });
});
