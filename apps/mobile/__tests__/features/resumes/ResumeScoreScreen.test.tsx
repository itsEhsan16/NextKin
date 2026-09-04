import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
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

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('ResumeScoreScreen (RESUMES 04 — 1:2109)', () => {
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
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <CreateSheetProvider>
            <ResumeScoreScreen id="res_base" />
          </CreateSheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // — Hero (1:2113–1:2121) —
    expect(
      await screen.findByLabelText('ATS score 92, Strong', {}, { timeout: 10000 }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'ATS score' })).toBeOnTheScreen();
    expect(screen.getByText('Strong')).toBeOnTheScreen();
    expect(
      screen.getByText('Parsers will read this cleanly. Four quick wins left before it is airtight.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Product Designer — Base · recalculates as you edit'),
    ).toBeOnTheScreen();

    // — Section headers with their pass counts (1:2123–1:2166) —
    expect(screen.getByRole('header', { name: 'Content' })).toBeOnTheScreen();
    expect(screen.getByText('4 of 5')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Format' })).toBeOnTheScreen();
    expect(screen.getByText('3 of 3')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Keywords' })).toBeOnTheScreen();
    expect(screen.getByText('2 of 4')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Best practices' })).toBeOnTheScreen();
    expect(screen.getByText('3 of 4')).toBeOnTheScreen();

    // — A passed check, a pending one, and the artboard's keyword misses —
    expect(screen.getByLabelText('Quantified achievements in 3+ bullets: passed')).toBeOnTheScreen();
    expect(screen.getByLabelText('Add metrics to your Zoho role: pending')).toBeOnTheScreen();
    expect(screen.getByText('Missing: "stakeholder management"')).toBeOnTheScreen();
    expect(screen.getByText('Missing: "A/B testing"')).toBeOnTheScreen();
    expect(
      screen.getByText('Green checks appear the moment a fix lands — no re-scan needed.'),
    ).toBeOnTheScreen();

    // One Fix pill per unmet actionable item = the CTA's quick-win count.
    expect(screen.getAllByLabelText(/^Fix: /)).toHaveLength(4);

    // — Fix pills and the sticky CTA route to the AI fix placeholder —
    fireEvent.press(screen.getByLabelText('Fix 4 quick wins'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/placeholder/[screen]',
      params: { screen: 'ats-fix' },
    });
    mockPush.mockClear();
    fireEvent.press(screen.getByLabelText('Fix: Add a portfolio link'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/placeholder/[screen]',
      params: { screen: 'ats-fix' },
    });

    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  }, 60000);
});
