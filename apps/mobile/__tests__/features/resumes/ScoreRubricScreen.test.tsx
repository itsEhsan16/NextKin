import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { SCORE_HONESTY_NOTE, SCORE_LABEL, SCORE_RUBRIC } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { ScoreRubricScreen } from '@/features/resumes';
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

/**
 * The applicant tracking systems V2 §7.8 names as the ones we must never claim results in. The
 * list is spelled out here rather than inferred so the guard actually fails if the copy drifts.
 */
const THIRD_PARTY_ATS = ['Workday', 'Greenhouse', 'Taleo', 'Lever', 'iCIMS'];

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('ScoreRubricScreen (V2 §7.8 — the published rubric)', () => {
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

  it('publishes the honesty note and the five weighted components, naming no third-party ATS', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <CreateSheetProvider>
            <ScoreRubricScreen id="res_base" />
          </CreateSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — The honesty note is the top of the page, not a footnote —
    expect(screen.getByRole('header', { name: `How the ${SCORE_LABEL} works` })).toBeOnTheScreen();
    expect(screen.getByText(SCORE_HONESTY_NOTE)).toBeOnTheScreen();

    // — Five components, each titled with the weight §7.8 gives it —
    expect(SCORE_RUBRIC).toHaveLength(5);
    expect(SCORE_RUBRIC.reduce((sum, component) => sum + component.weight, 0)).toBe(100);
    for (const component of SCORE_RUBRIC) {
      expect(screen.getByText(`${component.label} — ${component.weight}%`)).toBeOnTheScreen();
    }

    // — Each row opens onto its explanation. The press is awaited because a bare `fireEvent.press`
    //   does not flush the toggle's state update here, and the body stays unmounted until it does.
    for (const component of SCORE_RUBRIC) {
      await act(async () =>
        fireEvent.press(screen.getByLabelText(`${component.label} — ${component.weight}%`)),
      );
    }
    for (const component of SCORE_RUBRIC) {
      // An opened row's body enters on a FadeIn, and Reanimated's jest mock leaves that at
      // opacity 0 — so it is on the screen but "hidden" as far as the queries are concerned.
      expect(screen.getByText(component.detail, { includeHiddenElements: true })).toBeOnTheScreen();
    }

    // — The caption names the document the reader came from —
    expect(
      await screen.findByText(
        'Opened from "Product Designer" — every document is scored the same way.',
        {},
        { timeout: 10000 },
      ),
    ).toBeOnTheScreen();

    // — §7.8: no copy may claim compatibility with, or results in, a named third-party ATS —
    const rendered = JSON.stringify(screen.toJSON());
    for (const vendor of THIRD_PARTY_ATS) {
      expect(rendered).not.toMatch(new RegExp(vendor, 'i'));
    }

    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);
});
