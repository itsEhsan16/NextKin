import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

async function renderReview() {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <JdReviewScreen draftId={DRAFT_ID} />
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

  it('renders the extraction: source caption, editable fields and both skill groups', async () => {
    await renderReview();

    expect(screen.getByRole('header', { name: 'Check what we read' })).toBeOnTheScreen();

    const titleField = await screen.findByLabelText('Job title', {}, { timeout: 15000 });
    expect(titleField).toHaveProp('value', 'Senior Product Designer');
    expect(screen.getByLabelText('Company')).toHaveProp('value', 'Stripe');
    // The caption names where the extraction came from (JD_SOURCE_LABEL).
    expect(screen.getByText('From a job listing · edit anything we misread.')).toBeOnTheScreen();

    expect(screen.getByRole('header', { name: 'Required skills' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Design systems')).toBeOnTheScreen();
    expect(screen.getByLabelText('Figma')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Preferred skills' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Fintech')).toBeOnTheScreen();

    // §7.5 keeps the source text beside the extraction.
    expect(screen.getByRole('header', { name: 'Original text' })).toBeOnTheScreen();
    expect(screen.getByLabelText('The listing we read')).toBeOnTheScreen();
  }, 30000);

  it('removes a required skill through the chip menu', async () => {
    await renderReview();
    await screen.findByLabelText('Figma', {}, { timeout: 15000 });

    fireEvent.press(screen.getByLabelText('Figma'));
    // One tap target, one meaning: the chip opens the menu, the menu owns the two verbs.
    expect(await screen.findByLabelText('Move to preferred')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Remove'));

    // Optimistic, so the chip goes before the write lands.
    await waitFor(() => expect(screen.queryByLabelText('Figma')).toBeNull());
    await waitFor(() => expect(storedDraft()?.requiredSkills).toEqual(['Design systems']), {
      timeout: 15000,
    });
    // Removing is not moving: the other group is untouched.
    expect(storedDraft()?.preferredSkills).toEqual(['Fintech']);
  }, 30000);

  it('moves a required skill into the preferred group', async () => {
    await renderReview();
    await screen.findByLabelText('Design systems', {}, { timeout: 15000 });

    fireEvent.press(screen.getByLabelText('Design systems'));
    fireEvent.press(await screen.findByLabelText('Move to preferred'));

    await waitFor(() => expect(storedDraft()?.requiredSkills).toEqual(['Figma']), {
      timeout: 15000,
    });
    expect(storedDraft()?.preferredSkills).toEqual(['Fintech', 'Design systems']);
  }, 30000);

  it('starts a resume generation for this draft and replaces the form with it', async () => {
    await renderReview();
    await screen.findByLabelText('Job title', {}, { timeout: 15000 });

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
});
