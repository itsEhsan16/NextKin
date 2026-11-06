import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ConfirmEmailScreen, useSessionStore } from '@/features/auth';
import { CODE_WRONG } from '@/features/auth/authForms';
import { usePendingSignUp } from '@/features/auth/pendingSignUp';

const mockReplace = jest.fn();
const mockConfirm = jest.fn();
const mockLogin = jest.fn();
const mockResend = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  Link: ({ children }: PropsWithChildren) => children,
}));

// The screen exists only on the backend; the identity provider is stood in for here.
jest.mock('@/data/dataSource', () => ({
  USES_BACKEND: true,
  auth: {
    confirm: (...args: unknown[]) => mockConfirm(...args),
    login: (...args: unknown[]) => mockLogin(...args),
    resendCode: (...args: unknown[]) => mockResend(...args),
  },
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ConfirmEmailScreen />
    </SafeAreaProvider>,
  );

const press = async (label: string) =>
  act(async () => fireEvent.press(screen.getByLabelText(label)));

const typeCode = async (value: string) =>
  act(async () => fireEvent.changeText(screen.getByLabelText('Verification code'), value));

/** Confirm the emailed code (V2 §7.1, P5-08): spec-derived, built from existing primitives. */
describe('ConfirmEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({ status: 'signed_out' });
    usePendingSignUp.getState().start('robin@example.test', 'correct horse battery staple');
  });
  afterEach(() => {
    cleanup();
    usePendingSignUp.getState().clear();
  });

  it('names the address the code went to', async () => {
    await renderScreen();
    expect(screen.getByText(/robin@example\.test/)).toBeTruthy();
  });

  it('keeps digits only, at most six', async () => {
    await renderScreen();
    await typeCode('12a34');
    expect(screen.getByLabelText('Verification code').props.value).toBe('1234');
  });

  it('confirms, signs in with the password just chosen, and forgets it', async () => {
    mockConfirm.mockResolvedValue(undefined);
    mockLogin.mockResolvedValue({});
    await renderScreen();
    await typeCode('123456');
    expect(mockConfirm).toHaveBeenCalledWith('robin@example.test', '123456');
    expect(mockLogin).toHaveBeenCalledWith('robin@example.test', 'correct horse battery staple');
    expect(useSessionStore.getState().status).toBe('signed_in');
    expect(usePendingSignUp.getState().password).toBe('');
  });

  it('a wrong code says so and stays signed out', async () => {
    mockConfirm.mockRejectedValue({ code: 'VALIDATION_FAILED', details: { code: 'invalid' } });
    await renderScreen();
    await typeCode('000000');
    await press('Confirm');
    expect(screen.getByText(CODE_WRONG)).toBeTruthy();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });

  it('unlocks resend after a short wait, then sends a new code', async () => {
    jest.useFakeTimers();
    mockResend.mockResolvedValue(undefined);
    await renderScreen();
    expect(screen.getByText(/Resend code in 30s/)).toBeTruthy();
    for (let i = 0; i < 30; i += 1) await act(() => jest.advanceTimersByTimeAsync(1000));
    await press('Resend code');
    expect(mockResend).toHaveBeenCalledWith('robin@example.test');
    await act(() => jest.runOnlyPendingTimersAsync());
    jest.useRealTimers();
  });

  it('submits itself once all six digits are in', async () => {
    mockConfirm.mockResolvedValue(undefined);
    mockLogin.mockResolvedValue({});
    await renderScreen();
    await typeCode('654321');
    expect(mockConfirm).toHaveBeenCalledWith('robin@example.test', '654321');
  });

  it('with no sign-up waiting (the app was closed), it offers sign-in instead', async () => {
    usePendingSignUp.getState().clear();
    await renderScreen();
    await press('Go to sign in');
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });
});
