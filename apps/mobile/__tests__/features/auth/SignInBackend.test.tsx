import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { SignInScreen, useSessionStore } from '@/features/auth';
import { GOOGLE_NOT_CONNECTED, SIGN_IN_FAILED } from '@/features/auth/authForms';

const mockLogin = jest.fn();
const mockResend = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

jest.mock('@/data/dataSource', () => ({
  USES_BACKEND: true,
  auth: {
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
      <SignInScreen />
    </SafeAreaProvider>,
  );

const fill = async () => {
  await act(async () =>
    fireEvent.changeText(screen.getByLabelText('Email address'), ' robin@example.test '),
  );
  await act(async () =>
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret passphrase'),
  );
};

/** Sign-in on the backend (P5-08): the identity provider decides, and a refusal is said. */
describe('SignInScreen on the backend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({ status: 'signed_out' });
  });
  afterEach(cleanup);

  it('signs in only once the identity provider accepts the details', async () => {
    mockLogin.mockResolvedValue({});
    await renderScreen();
    await fill();
    await act(async () => fireEvent.press(screen.getByLabelText('Sign In')));
    expect(mockLogin).toHaveBeenCalledWith('robin@example.test', 'secret passphrase');
    expect(useSessionStore.getState().status).toBe('signed_in');
  });

  it('an unconfirmed account gets a fresh code and the boxes right here (§184)', async () => {
    mockLogin.mockRejectedValue({ code: 'FORBIDDEN', details: { notConfirmed: true } });
    mockResend.mockResolvedValue(undefined);
    await renderScreen();
    await fill();
    await act(async () => fireEvent.press(screen.getByLabelText('Sign In')));

    expect(mockResend).toHaveBeenCalledWith('robin@example.test');
    expect(screen.getByText('Confirm your email')).toBeTruthy();
    expect(screen.getByLabelText('Verification code')).toBeTruthy();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });

  it('a refusal is said under the button, and nobody is signed in', async () => {
    mockLogin.mockRejectedValue({ code: 'UNAUTHENTICATED' });
    await renderScreen();
    await fill();
    await act(async () => fireEvent.press(screen.getByLabelText('Sign In')));
    expect(screen.getByText(SIGN_IN_FAILED)).toBeTruthy();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });

  it('Google says it is not connected yet rather than signing into the mock', async () => {
    await renderScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Continue with Google')));
    expect(screen.getByText(GOOGLE_NOT_CONNECTED)).toBeTruthy();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });
});
