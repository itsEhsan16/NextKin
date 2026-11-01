import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import type { ResumeContent } from '@/data/models';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { ResumeVersionsScreen } from '@/features/resumes';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const ID = 'res_base';
const clients: QueryClient[] = [];
const settle = (ms = 3000) => act(() => jest.advanceTimersByTimeAsync(ms));

async function renderScreen(id = ID) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <ResumeVersionsScreen id={id} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** Two versions of the fixture resume, the newer a hand edit of its first summary line. */
function seedTwoVersions() {
  const content = mockStore.state.contents[ID] as ResumeContent;
  mockStore.state.resumeVersions = [
    {
      id: 'v_old',
      resumeId: ID,
      version: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
      actor: 'upload',
    },
    {
      id: 'v_new',
      resumeId: ID,
      version: 2,
      createdAt: '2026-10-20T00:00:00.000Z',
      actor: 'user',
      changeNote: 'Edited your summary',
    },
  ];
  mockStore.state.contentVersions.v_old = content;
  mockStore.state.contentVersions.v_new = { ...content, summary: 'A new summary.' };
}

describe('ResumeVersionsScreen (what changed and why)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('opens on the newest version, with what it changed and why', async () => {
    seedTwoVersions();
    await renderScreen();
    expect(screen.getByLabelText('Loading versions')).toBeOnTheScreen();
    await settle();

    expect(screen.getByRole('header', { name: 'Versions' })).toBeOnTheScreen();
    expect(screen.getByText('Edited your summary')).toBeOnTheScreen();
    await settle();
    expect(screen.getByText('A new summary.')).toBeOnTheScreen();
    expect(screen.getByText('You changed this.')).toBeOnTheScreen();
    expect(screen.getByText('Added or changed')).toBeOnTheScreen();
  });

  it('says so when the first version has nothing to compare with', async () => {
    seedTwoVersions();
    await renderScreen();
    await settle();

    await act(async () => fireEvent.press(screen.getByLabelText(/^Version 1 ·/)));
    await settle();
    expect(screen.getByText('No lines changed in this version.')).toBeOnTheScreen();
    expect(screen.queryByText('You changed this.')).toBeNull();
  });

  it('says so when there are no versions, and offers a retry when it can’t load', async () => {
    mockStore.state.resumeVersions = [];
    await renderScreen();
    await settle();
    expect(screen.getByText('No versions yet')).toBeOnTheScreen();
    await cleanup();

    useMockModeStore.setState({ mode: 'error' });
    await renderScreen();
    await settle(8000);
    expect(screen.getByText("Couldn't load your versions")).toBeOnTheScreen();
  });
});
