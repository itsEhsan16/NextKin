import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useMockModeStore } from '@/data/mock';
import { createQueryClient } from '@/data/queries';
import { mockStore, resetMockRepos } from '@/data/repos';
import { EmailPasswordScreen } from '@/features/account';
import { CHANGE_PASSWORD } from '@/features/account/components/PasswordGroup';
import { SEND_VERIFICATION } from '@/features/account/components/EmailGroup';
import { SIGN_OUT_EVERYWHERE } from '@/features/account/components/SessionsGroup';
import { useSessionStore } from '@/features/auth';

const mockBack = jest.fn();
const clients: QueryClient[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: mockBack, replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Mock repos resolve on (fake) timers well inside a second. */
const settle = (ms = 1000) => act(() => jest.advanceTimersByTimeAsync(ms));
const press = async (label: string) =>
  act(async () => fireEvent.press(screen.getByLabelText(label)));
const type = async (label: string, value: string) =>
  act(async () => fireEvent.changeText(screen.getByLabelText(label), value));

/**
 * One mount per file. The session store is reset on both sides: this suite signs the account out
 * of every device, and every other suite in the repo assumes it starts signed in.
 */
describe('EmailPasswordScreen (V2 §7.1, §8.4 — ACCOUNT 01)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockRepos();
    mockBack.mockClear();
    useSessionStore.setState({ status: 'signed_in' });
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    useMockModeStore.setState({ mode: 'normal' });
    useSessionStore.setState({ status: 'signed_in' });
    jest.useRealTimers();
  });

  it('verifies a new address, changes a password, and ends every session on confirm', async () => {
    const queryClient = createQueryClient();
    clients.push(queryClient);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <EmailPasswordScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    await settle();

    const current = mockStore.state.user.email;
    expect(screen.getByLabelText(`Current address, ${current}`)).toBeOnTheScreen();

    // — The address has to actually change before there is anything to verify —
    expect(screen.getByLabelText(SEND_VERIFICATION)).toBeDisabled();
    await type('New email address', current);
    expect(screen.getByLabelText(SEND_VERIFICATION)).toBeDisabled();

    await type('New email address', 'george@nextkin.app');
    expect(screen.getByLabelText(SEND_VERIFICATION)).not.toBeDisabled();
    await press(SEND_VERIFICATION);
    await settle();
    expect(mockStore.state.user.email).toBe('george@nextkin.app');

    // — Password: three boxes, and the reason is stated rather than left to a disabled button —
    expect(screen.getByLabelText(CHANGE_PASSWORD)).toBeDisabled();
    await type('Current password', 'old-one-here');
    await type('New password', 'new-one-here');
    await type('Confirm new password', 'new-one-heer');
    expect(screen.getByLabelText(CHANGE_PASSWORD)).toBeDisabled();

    await type('Confirm new password', 'new-one-here');
    expect(screen.getByLabelText(CHANGE_PASSWORD)).not.toBeDisabled();
    await press(CHANGE_PASSWORD);
    await settle();
    // The boxes empty on success, so a password is never left sitting on screen.
    expect(screen.getByLabelText('Current password').props.value).toBe('');
    expect(screen.getByLabelText('New password').props.value).toBe('');

    // — Sessions: this device is one of the ones being revoked (§7.1) —
    await press(SIGN_OUT_EVERYWHERE);
    expect(screen.getByRole('header', { name: 'Sign out everywhere?' })).toBeOnTheScreen();
    // Nothing has happened yet — the confirm is the whole point of the row.
    expect(useSessionStore.getState().status).toBe('signed_in');

    // The sheet's own confirm, not the row that opened it — they read differently on purpose.
    await press('Sign out');
    await settle();
    expect(useSessionStore.getState().status).toBe('signed_out');
  }, 60000);
});
