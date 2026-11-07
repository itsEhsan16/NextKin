import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { CODE_WRONG } from '@/features/auth/authForms';
import { CodeStep } from '@/features/auth/components/CodeStep';

const mockConfirm = jest.fn();
const mockLogin = jest.fn();
const mockResend = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

// The code exists only on the backend; the identity provider is stood in for here.
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

const onDone = jest.fn();
const onChangeEmail = jest.fn();

const renderStep = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CodeStep
        email="robin@example.test"
        password="correct horse battery staple"
        onDone={onDone}
        onChangeEmail={onChangeEmail}
      />
    </SafeAreaProvider>,
  );

const typeCode = async (value: string) =>
  act(async () => fireEvent.changeText(screen.getByLabelText('Verification code'), value));

/** The email code on the sign-up / sign-in screen itself (owner, 2026-11-08, §184). */
describe('CodeStep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await act(() => jest.runOnlyPendingTimersAsync());
    cleanup();
    jest.useRealTimers();
  });

  it('names the address the code went to', async () => {
    await renderStep();
    expect(screen.getByText('robin@example.test')).toBeTruthy();
  });

  it('keeps digits only, at most six', async () => {
    await renderStep();
    await typeCode('12a34');
    expect(screen.getByLabelText('Verification code').props.value).toBe('1234');
  });

  it('checks a full code at once, shows it confirmed, then moves on', async () => {
    mockConfirm.mockResolvedValue(undefined);
    mockLogin.mockResolvedValue({});
    await renderStep();
    await typeCode('123456');

    expect(mockConfirm).toHaveBeenCalledWith('robin@example.test', '123456');
    expect(screen.getByText('Email confirmed')).toBeTruthy();
    // The green boxes hold a moment before the app moves on.
    expect(onDone).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a wrong code says so and does not move on', async () => {
    mockConfirm.mockRejectedValue({ code: 'VALIDATION_FAILED', details: { code: 'invalid' } });
    await renderStep();
    await typeCode('000000');

    expect(screen.getByText(CODE_WRONG)).toBeTruthy();
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('unlocks resend after a short wait, then sends a new code', async () => {
    mockResend.mockResolvedValue(undefined);
    await renderStep();
    expect(screen.getByText(/Resend code in 30s/)).toBeTruthy();

    for (let i = 0; i < 30; i += 1) await act(() => jest.advanceTimersByTimeAsync(1000));
    await act(async () => fireEvent.press(screen.getByLabelText('Resend code')));
    expect(mockResend).toHaveBeenCalledWith('robin@example.test');
  });

  it('goes back to the form to use a different email', async () => {
    await renderStep();
    await act(async () => fireEvent.press(screen.getByLabelText('Use a different email')));
    expect(onChangeEmail).toHaveBeenCalledTimes(1);
  });
});
