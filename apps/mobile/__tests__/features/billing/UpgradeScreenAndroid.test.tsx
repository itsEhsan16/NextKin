import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

/**
 * Android, deliberately: jest-expo runs every other suite as iOS. Google Play's Payments policy
 * bars a web checkout (and any link to one) from an Android app, so on Android the plan screen
 * must sell nothing and open nothing (storePolicy.ts, owner 2026-11-20).
 */
jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const actual = jest.requireActual('react-native/Libraries/Utilities/Platform');
  const base = actual.default ?? actual;
  return { ...base, OS: 'android', __esModule: true, default: { ...base, OS: 'android' } };
});

const mockOpen = jest.fn(() => Promise.resolve('done'));
jest.mock('@/lib/openUrl', () => ({
  ...jest.requireActual('@/lib/openUrl'),
  openExternalUrl: (...args: unknown[]) => mockOpen(...(args as [])),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: mockBack, replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

/* eslint-disable import/first -- must follow the mocks above. */
import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { resetMockRepos } from '@/data/repos';
import { REASON_LINE, UpgradeScreen, type UpgradeScreenProps } from '@/features/billing';
import { STORE_FREE_NOTE } from '@/features/billing/storePolicy';
/* eslint-enable import/first */

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const HIDDEN = { includeHiddenElements: true } as const;
const clients: QueryClient[] = [];

async function renderUpgrade(props: UpgradeScreenProps = {}) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <UpgradeScreen {...props} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const settle = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));

describe('UpgradeScreen on Android (Play Payments policy)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockBack.mockClear();
    mockOpen.mockClear();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('shows the plans and the limit, with no checkout, price button or web link', async () => {
    await renderUpgrade({ reason: 'docx' });
    await settle(1000);

    expect(screen.getByText(REASON_LINE.docx, HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText(STORE_FREE_NOTE)).toBeOnTheScreen();
    expect(screen.queryByText('Start Pro', HIDDEN)).toBeNull();
    expect(screen.queryByText('Manage on the web', HIDDEN)).toBeNull();
    expect(screen.queryByText(/nextkin\.ai/, HIDDEN)).toBeNull();

    fireEvent.press(screen.getByText('Done'));
    expect(mockBack).toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
