import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { SignUpScreen, useOnboardingStore, useSessionStore } from '@/features/auth';
import { PASSWORD_HINT } from '@/features/auth/authForms';
import { storage } from '@/lib';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: mockReplace }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const SESSION = useSessionStore.getState();
const ONBOARDING = useOnboardingStore.getState();

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SignUpScreen />
    </SafeAreaProvider>,
  );

const type = async (field: string, value: string) =>
  act(async () => fireEvent.changeText(screen.getByLabelText(field), value));
const press = async (name: string) =>
  act(async () => fireEvent.press(screen.getByRole('button', { name })));

/** Create an account (toreview.md §172). */
describe('SignUpScreen', () => {
  beforeEach(() => {
    storage.remove('prefs.session');
    useSessionStore.setState({ status: 'signed_out' });
    useOnboardingStore.setState({ seen: false });
    mockReplace.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    storage.remove('prefs.session');
    useSessionStore.setState(SESSION, true);
    useOnboardingStore.setState(ONBOARDING, true);
  });

  it('shows three fields, the password rule up front, and one button', async () => {
    await renderScreen();
    expect(screen.getByRole('header', { name: 'Create your account' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Full name')).toBeOnTheScreen();
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.getByLabelText('Password')).toBeOnTheScreen();
    expect(screen.getByText(PASSWORD_HINT)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeOnTheScreen();
  });

  it('refuses an empty form and stays signed out', async () => {
    await renderScreen();
    await press('Create account');
    expect(screen.getByText('Add your name.')).toBeOnTheScreen();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });

  it('catches a malformed email and a short password on the field', async () => {
    await renderScreen();
    await type('Full name', 'Robin');
    await type('Email', 'robin@');
    await type('Password', 'short');
    await press('Create account');
    expect(screen.getByText('Check the email address.')).toBeOnTheScreen();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });

  it('signs in as a new user on the mock once the form is valid', async () => {
    await renderScreen();
    await type('Full name', 'Robin Ade');
    await type('Email', 'robin@example.test');
    await type('Password', 'long enough');
    await press('Create account');
    expect(useSessionStore.getState().status).toBe('signed_in');
    expect(useOnboardingStore.getState().seen).toBe(true);
  });

  it('swaps to sign-in in place', async () => {
    await renderScreen();
    await press('Sign in');
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});
