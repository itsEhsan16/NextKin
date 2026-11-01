import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { rescoreStored } from '@nextkin/shared/repos/scoring';

import { useMockModeStore } from '@/data/mock';
import type { ResumeContent } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { AtsFixScreen } from '@/features/resumes';
import { CreateSheetProvider } from '@/navigation';

const mockPush = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack, replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * res_zoho scored by the engines (C-10) against a JD that asks for Figma and Prototyping, with
 * both taken off the document: the profile backs each (on its Flipkart and Swiggy roles), so each
 * is a quick win the product may make itself. Kubernetes, which nothing on the profile backs, is
 * the gap: shown, explained, never inserted.
 */
function seedPanel() {
  const content = mockStore.state.contents.res_zoho as ResumeContent;
  const drop = (skills: string[] = []) => skills.filter((s) => s !== 'Figma' && s !== 'Prototyping');
  const edited: ResumeContent = {
    ...content,
    skills: drop(content.skills),
    experience: content.experience.map((role) => ({ ...role, skills: drop(role.skills) })),
  };
  mockStore.state.contents.res_zoho = edited;
  mockStore.state.scoringJds.res_zoho = {
    requiredSkills: ['Figma', 'Prototyping'],
    preferredSkills: ['Kubernetes'],
    tools: [],
    rawText: '',
    completeness: 'snippet',
  };
  const score = rescoreStored(mockStore.state, 'res_zoho', edited);
  if (!score) throw new Error('res_zoho should be scored');
  return score;
}
let seeded: ReturnType<typeof seedPanel>;
let bulletsBefore: string[] = [];

/** Mock repos resolve in 300–900ms; one apply also re-reads the detail and the score. */
const settle = (ms = 1000) => act(() => jest.advanceTimersByTimeAsync(ms));

const pressApply = async (index: number) => {
  const button = screen.getAllByLabelText('Apply')[index];
  expect(button).toBeDefined();
  // A bare press does not flush the state update that swaps the button for the tick.
  await act(async () => {
    if (button) fireEvent.press(button);
  });
};

const storedScore = () => mockStore.state.atsScores.res_zoho;

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('AtsFixScreen (V2 §7.8 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    seeded = seedPanel();
    bulletsBefore = (mockStore.state.contents.res_zoho as ResumeContent).experience.flatMap((role) => role.bullets);
    mockPush.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('lists the quick wins, applies one in place, and never offers a gap', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <CreateSheetProvider>
            <AtsFixScreen id="res_zoho" />
          </CreateSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — Loading: card-shaped blocks under a pinned bar that already owns the bottom inset —
    expect(screen.getByLabelText('Loading fixes')).toBeOnTheScreen();
    expect(screen.getByLabelText('Apply all')).toBeDisabled();

    // Two rounds, not one: the score query is gated on the metadata saying the document HAS a
    // score, so it cannot start until the detail has landed.
    await settle();
    await settle();

    // — The page, and the one honest line about what Apply does (V2 §7.8) —
    expect(screen.getByRole('header', { name: 'Fix with AI' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Each fix edits your document and re-scores it. Nothing is added that your profile doesn't back.",
      ),
    ).toBeOnTheScreen();

    // — One card per quick win, each with its suggestion and the section the edit lands in —
    expect(screen.getByText('Missing: "Figma"')).toBeOnTheScreen();
    expect(screen.getByText('Missing: "Prototyping"')).toBeOnTheScreen();
    // Each lands on the role the profile shows it in, as that role's evidence.
    expect(screen.getAllByText('Add "Figma" to the role your profile shows it in')).toHaveLength(1);
    expect(screen.getAllByText('Add "Prototyping" to the role your profile shows it in')).toHaveLength(1);

    // — The gap is listed, explained, and has no Apply: §7.8 forbids inserting it —
    expect(screen.getByText('"Kubernetes" is not in your profile')).toBeOnTheScreen();
    expect(
      screen.getByText('Not in your profile, so we won’t add it. Have you used it?'),
    ).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Apply')).toHaveLength(2);
    expect(screen.getByLabelText('Apply all 2')).toBeOnTheScreen();

    // — Applying the first one ticks that card where it stands rather than removing it —
    await pressApply(0);
    await settle();
    await settle();

    // The card ticks where it stands, now reading as the met requirement it is.
    expect(screen.getByText('"Figma" shown in your experience')).toBeOnTheScreen();
    // The tick enters on FadeIn, which the Reanimated mock leaves at opacity 0.
    expect(screen.getByText('Applied', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getAllByLabelText('Apply')).toHaveLength(1);
    expect(screen.getByLabelText('Apply all 1')).toBeOnTheScreen();

    // The document really moved: the check passes and the score is higher than it was seeded.
    const after = storedScore();
    const figma = after?.sections
      .flatMap((section) => section.items)
      .find((item) => item.id === 'kw:figma');
    expect(figma?.passed).toBe(true);
    // Nothing was invented: the bullets are the ones the document had (C-10).
    const bullets = (content: unknown) => (content as ResumeContent).experience.flatMap((role) => role.bullets);
    expect(bullets(mockStore.state.contents.res_zoho)).toEqual(bulletsBefore);
    expect(after?.total).toBeGreaterThan(seeded.total);

    // The gap survived the re-score untouched, still without an action.
    expect(screen.getByText('"Kubernetes" is not in your profile')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);
});
