import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { ProfileScreen, useProfileStore } from '@/features/profile';

import { insideScroller } from '../../../testSupport/scroller';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useProfileStore.getState();
const clients: QueryClient[] = [];

/**
 * One mount per file — see the test-infra note in the plan's Phase 3 status. This is why the
 * assertion does not simply join `ProfileScreen.test.tsx`, which is deliberately a single walk.
 */
describe('Profile pinned header', () => {
  beforeEach(() => {
    resetMockRepos();
    useProfileStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.cancelQueries()));
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('pins the title row and the whole identity block', async () => {
    useMockModeStore.setState({ mode: 'normal' });
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <ProfileScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // Profile pins the most of the four: the title row *and* the identity block below it, which
    // is the ring, the name, the role line, Edit and the availability chip.
    expect(await screen.findByText('George Smith', {}, { timeout: 15000 })).toBeOnTheScreen();
    for (const node of [
      screen.getByRole('header', { name: 'Profile' }),
      screen.getByText('George Smith'),
      screen.getByLabelText('Profile 72% complete'),
      screen.getByLabelText('Edit profile'),
      screen.getByLabelText('Availability: Open to offers'),
    ]) {
      expect(insideScroller(node)).toBe(false);
    }

    // Everything from the stats card down still scrolls.
    expect(insideScroller(screen.getByRole('header', { name: 'CAREER PROFILE' }))).toBe(true);
  }, 30000);
});
