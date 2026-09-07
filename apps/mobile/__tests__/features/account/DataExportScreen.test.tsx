import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { DATA_EXPORT_MS, resetMockRepos } from '@/data/repos';
import { DataExportScreen } from '@/features/account';
import {
  DATA_EXPORT_SHARE_UNAVAILABLE,
  DATA_EXPORT_TITLE,
  DATA_EXPORT_WRITE_FAILED,
} from '@/features/account/dataExportCopy';

/**
 * Only the two native side effects are stubbed; formatters, a11y helpers and reduced motion all
 * stay real, so this exercises the screen's own logic rather than a hollowed-out module.
 */
jest.mock('@/lib', () => ({
  ...jest.requireActual('@/lib'),
  writeTextFile: jest.fn(),
  shareFile: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const lib = require('@/lib') as {
  writeTextFile: jest.Mock;
  shareFile: jest.Mock;
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const clients: QueryClient[] = [];
const settle = (ms = 1000) => act(() => jest.advanceTimersByTimeAsync(ms));
const press = async (label: string) =>
  act(async () => fireEvent.press(screen.getByLabelText(label)));

/** One mount per file — see the test-infra note in the plan's Phase 3 status. */
describe('DataExportScreen (V2 §8.5 — no artboard)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    lib.writeTextFile.mockReset();
    lib.shareFile.mockReset();
    lib.writeTextFile.mockResolvedValue({ uri: 'file:///cache/nextkin-export.json', name: 'x' });
    lib.shareFile.mockResolvedValue('done');
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    jest.useRealTimers();
  });

  it('walks idle → preparing → ready, then writes the file and hands it to the share sheet', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <DataExportScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    await settle();

    // — Idle: the card names the file, and the bullets below name what is in it —
    expect(screen.getByRole('header', { name: DATA_EXPORT_TITLE })).toBeOnTheScreen();
    expect(screen.getByText(/A JSON file of what NextKin holds about you/)).toBeOnTheScreen();
    expect(lib.writeTextFile).not.toHaveBeenCalled();

    await press('Request export');
    await settle();

    // — Preparing: the spec's own time claim, and no invented percentage —
    expect(screen.getByText(/Usually under a minute/)).toBeOnTheScreen();

    // — Ready: the query polls itself every second, so step the clock rather than jumping it —
    await settle(DATA_EXPORT_MS);
    await settle(2000);
    expect(screen.getByText(/nextkin/)).toBeOnTheScreen();

    await press('Download export');
    await settle();
    expect(lib.writeTextFile).toHaveBeenCalledTimes(1);
    // The file is the payload this screen assembled, not bytes from the repo.
    const [fileName, contents] = lib.writeTextFile.mock.calls[0] as [string, string];
    expect(fileName).toMatch(/\.json$/);
    expect(JSON.parse(contents)).toMatchObject({ format: 'nextkin-account-export' });
    expect(lib.shareFile).toHaveBeenCalledTimes(1);

    // — A share the device cannot do says so on the page; there is no toast host above a push —
    lib.shareFile.mockResolvedValue('unavailable');
    await press('Download export');
    await settle();
    expect(screen.getByText(DATA_EXPORT_SHARE_UNAVAILABLE)).toBeOnTheScreen();

    // — And a file that could not be written is a different sentence again —
    lib.writeTextFile.mockResolvedValue(null);
    await press('Download export');
    await settle();
    expect(screen.getByText(DATA_EXPORT_WRITE_FAILED)).toBeOnTheScreen();
  }, 60000);
});
