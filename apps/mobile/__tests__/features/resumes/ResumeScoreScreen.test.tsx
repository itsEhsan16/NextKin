import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { rescoreStored } from '@nextkin/shared/repos/scoring';

import { useMockModeStore } from '@/data/mock';
import { ATS_BAND_LABEL, atsQuickWins, atsSectionPassed, type ResumeContent } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ResumeScoreScreen } from '@/features/resumes';
import { CreateSheetProvider } from '@/navigation';

const mockPush = jest.fn();
const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const ID = 'res_2';

/**
 * res_2 as the engines score it against Stripe's listing (C-10), with Figma taken off its roles and
 * skills: the profile backs Figma, so the panel offers one quick win the product may make itself,
 * and Fintech stays a gap it never inserts. The board's 92 and its copy were the base resume's,
 * which has no JD and so no total (D-15).
 */
function seedQuickWin() {
  const content = mockStore.state.contents[ID] as ResumeContent;
  const without = (skills: string[] = []) => skills.filter((skill) => skill !== 'Figma');
  const edited: ResumeContent = {
    ...content,
    skills: without(content.skills),
    experience: content.experience.map((role) => ({ ...role, skills: without(role.skills) })),
  };
  mockStore.state.contents[ID] = edited;
  const score = rescoreStored(mockStore.state, ID, edited);
  if (!score) throw new Error('res_2 should be scored');
  return score;
}

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('ResumeScoreScreen (RESUMES 04 — 95:2310)', () => {
  beforeEach(() => {
    resetMockRepos();
    mockPush.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('renders the hero, the rubric checklist, and routes the fixes', async () => {
    const score = seedQuickWin();
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <CreateSheetProvider>
            <ResumeScoreScreen id={ID} />
          </CreateSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — Hero (1:2113–1:2121): the engine's number and band, and a summary led by the job match —
    expect(
      await screen.findByLabelText(`ATS score ${score.total}, ${ATS_BAND_LABEL[score.band]}`, {}, { timeout: 10000 }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'ATS score' })).toBeOnTheScreen();
    expect(screen.getByText(score.summary)).toBeOnTheScreen();
    expect(score.summary).toMatch(/^Meets 1 of 2 required skills\./);
    expect(screen.getByText('Stripe — Senior PD — Tailored · recalculates as you edit')).toBeOnTheScreen();

    // — Section headers with their pass counts, each a check the number rests on —
    for (const section of score.sections) {
      expect(screen.getByRole('header', { name: section.label })).toBeOnTheScreen();
    }
    const keywords = score.sections.find((section) => section.key === 'keywords');
    expect(keywords && `${atsSectionPassed(keywords)} of ${keywords.items.length}`).toBe('1 of 3');

    // — The backed skill is a fix; the unbacked one is a gap, shown and never offered —
    expect(screen.getByText('Missing: "Figma"')).toBeOnTheScreen();
    expect(screen.getByText('"Fintech" is not in your profile')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Fix: "Fintech" is not in your profile')).toBeNull();

    // One Fix pill per unmet actionable item = the CTA's quick-win count.
    const wins = atsQuickWins(score);
    expect(wins).toHaveLength(1);
    expect(screen.getAllByLabelText(/^Fix: /)).toHaveLength(1);

    // — The pinned CTA opens the fix list at the top; one check opens it on that check's card —
    fireEvent.press(screen.getByLabelText('Fix 1 quick win'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/resumes/[id]/fix', params: { id: ID } });
    mockPush.mockClear();
    fireEvent.press(screen.getByLabelText('Fix: Missing: "Figma"'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/resumes/[id]/fix',
      params: { id: ID, item: 'kw:figma' },
    });

    // — V2 §7.8: the score display links to the published rubric —
    mockPush.mockClear();
    fireEvent.press(screen.getByLabelText('What this score measures'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/resumes/[id]/rubric', params: { id: ID } });

    // - V2 section 7.16: the score panel opens the assistant about this document -
    mockPush.mockClear();
    fireEvent.press(screen.getByLabelText('Ask about this score'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/assistant', params: { resumeId: ID } });

    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);
});
