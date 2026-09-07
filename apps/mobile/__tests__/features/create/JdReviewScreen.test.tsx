import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { JdReviewScreen } from '@/features/create/screens/JdReviewScreen';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    back: jest.fn(),
    replace: mockReplace,
  }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const clients: QueryClient[] = [];

/** The one seeded extraction (`jdDraftsFixture`), read out of the Stripe listing. */
const DRAFT_ID = 'jd_stripe';

const storedDraft = () => mockStore.state.jdDrafts.find((draft) => draft.id === DRAFT_ID);

async function renderReview(draftId = DRAFT_ID) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <JdReviewScreen draftId={draftId} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('JdReviewScreen (V2 §7.5)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockReplace.mockClear();
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('renders every extracted field as something the user can correct', async () => {
    await renderReview();

    expect(screen.getByRole('header', { name: 'Check what we read' })).toBeOnTheScreen();

    const titleField = await screen.findByLabelText('Job title', {}, { timeout: 15000 });
    expect(titleField).toHaveProp('value', 'Senior Product Designer');
    expect(screen.getByLabelText('Company')).toHaveProp('value', 'Stripe');
    // The caption names where the extraction came from (JD_SOURCE_LABEL).
    expect(screen.getByText('From a job listing')).toBeOnTheScreen();

    // §7.5: "every extracted field is editable" — location, industry and seniority included.
    expect(screen.getByLabelText('Location')).toHaveProp('value', 'Bengaluru');
    expect(screen.getByLabelText('Industry')).toHaveProp('value', 'Financial infrastructure');
    expect(screen.getByLabelText('Senior')).toHaveProp('accessibilityState', { selected: true });

    expect(screen.getByRole('header', { name: 'Required skills' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Design systems, required skill')).toBeOnTheScreen();
    expect(screen.getByLabelText('Figma, required skill')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Preferred skills' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Fintech, preferred skill')).toBeOnTheScreen();
    // The same word in two groups is why each chip is named for its list.
    expect(screen.getByRole('header', { name: 'Tools' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Figma, tool')).toBeOnTheScreen();

    expect(screen.getByLabelText('Responsibility 1')).toHaveProp(
      'value',
      'Own onboarding flows across web and mobile',
    );

    // §7.5 keeps the source text beside the extraction.
    expect(screen.getByRole('header', { name: 'Original text' })).toBeOnTheScreen();
    expect(screen.getByLabelText('The listing we read')).toBeOnTheScreen();
  }, 30000);

  it('removes a required skill through the chip menu', async () => {
    await renderReview();
    await screen.findByLabelText('Figma, required skill', {}, { timeout: 15000 });

    fireEvent.press(screen.getByLabelText('Figma, required skill'));
    // One tap target, one meaning: the chip opens the menu, the menu owns the two verbs.
    expect(await screen.findByLabelText('Move to preferred')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Remove'));

    // Optimistic, so the chip goes before the write lands.
    await waitFor(() => expect(screen.queryByLabelText('Figma, required skill')).toBeNull());
    await waitFor(() => expect(storedDraft()?.requiredSkills).toEqual(['Design systems']), {
      timeout: 15000,
    });
    // Removing is not moving: the other lists are untouched.
    expect(storedDraft()?.preferredSkills).toEqual(['Fintech']);
    expect(storedDraft()?.tools).toEqual(['Figma']);
  }, 30000);

  it('moves a required skill into the preferred group', async () => {
    await renderReview();
    await screen.findByLabelText('Design systems, required skill', {}, { timeout: 15000 });

    fireEvent.press(screen.getByLabelText('Design systems, required skill'));
    fireEvent.press(await screen.findByLabelText('Move to preferred'));

    await waitFor(() => expect(storedDraft()?.requiredSkills).toEqual(['Figma']), {
      timeout: 15000,
    });
    expect(storedDraft()?.preferredSkills).toEqual(['Fintech', 'Design systems']);
  }, 30000);

  it('removes a responsibility', async () => {
    await renderReview();
    await screen.findByLabelText('Responsibility 1', {}, { timeout: 15000 });

    fireEvent.press(screen.getByLabelText('Remove responsibility 1'));

    await waitFor(
      () =>
        expect(storedDraft()?.responsibilities).toEqual([
          'Partner with research to run monthly usability tests',
          'Contribute to and extend the Stripe design system',
          'Mentor two mid-level designers',
        ]),
      { timeout: 15000 },
    );
  }, 30000);

  it('refuses a duplicate skill instead of clearing the field silently', async () => {
    await renderReview();
    await screen.findByLabelText('Add a preferred skill', {}, { timeout: 15000 });

    const field = screen.getByLabelText('Add a preferred skill');
    await act(async () => fireEvent.changeText(field, 'figma'));
    await act(async () => fireEvent(field, 'submitEditing'));

    expect(screen.getByText('Already a required skill — move it from there.')).toBeOnTheScreen();
    // The entry survives, so the user can see what was refused.
    expect(screen.getByLabelText('Add a preferred skill')).toHaveProp('value', 'figma');
    expect(storedDraft()?.preferredSkills).toEqual(['Fintech']);
  }, 30000);

  it('starts a resume generation for this draft and replaces the form with it', async () => {
    await renderReview();
    await screen.findByLabelText('Job title', {}, { timeout: 15000 });

    // The cap before the work (§13.5), and what the press costs.
    expect(screen.getByText('1 of 3 generations left this month')).toBeOnTheScreen();
    expect(screen.getByText("Counts as one of this month's generations")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Generate resume'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1), { timeout: 15000 });
    const target = mockReplace.mock.calls[0]?.[0] as {
      pathname: string;
      params: { id: string };
    };
    expect(target.pathname).toBe('/generations/[id]');

    const generation = mockStore.state.generations.find((run) => run.id === target.params.id);
    expect(generation?.kind).toBe('resume');
    expect(generation?.jdId).toBe(DRAFT_ID);
  }, 30000);

  it('says why a generation could not be started and leaves the button live (§7.6)', async () => {
    await renderReview();
    await screen.findByLabelText('Job title', {}, { timeout: 15000 });

    useMockModeStore.setState({ mode: 'error' });
    fireEvent.press(screen.getByLabelText('Generate resume'));

    expect(
      await screen.findByText(
        "We couldn't start it. Check your connection and try again.",
        {},
        { timeout: 15000 },
      ),
    ).toBeOnTheScreen();
    // Never a silent hang: nothing navigated, and a second press is the retry.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Generate resume')).toBeOnTheScreen();
  }, 30000);

  it('offers a way out when the draft id resolves to nothing', async () => {
    await renderReview('');

    // A disabled query never leaves "pending", so this must not sit on the skeleton forever.
    expect(
      await screen.findByText("We couldn't find that job description", {}, { timeout: 15000 }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Start a new one')).toBeOnTheScreen();
  }, 30000);
});
