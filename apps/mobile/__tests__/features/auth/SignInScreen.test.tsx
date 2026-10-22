import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { SignInScreen, useOnboardingStore, useSessionStore } from '@/features/auth';
import { storage } from '@/lib';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: mockBack, replace: mockReplace }),
  Link: ({ children }: PropsWithChildren) => children,
}));

/** Every suite uses the same phone: 390×844, notch + home indicator. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const SESSION = useSessionStore.getState();
const ONBOARDING = useOnboardingStore.getState();

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SignInScreen />
    </SafeAreaProvider>,
  );

const type = async (field: string, value: string) =>
  act(async () => fireEvent.changeText(screen.getByLabelText(field), value));

const press = async (label: string) =>
  act(async () => fireEvent.press(screen.getByLabelText(label)));

/** Sign in (Figma 309:175) — the screen that retires toreview.md §6.6's design-gated stub. */
describe('SignInScreen', () => {
  beforeEach(() => {
    storage.remove('prefs.session');
    storage.remove('prefs.onboardingSeen');
    useSessionStore.setState({ status: 'signed_out' });
    useOnboardingStore.setState({ seen: false });
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    storage.remove('prefs.session');
    storage.remove('prefs.onboardingSeen');
    useSessionStore.setState(SESSION, true);
    useOnboardingStore.setState(ONBOARDING, true);
  });

  it('draws the form the artboard draws', async () => {
    await renderScreen();

    expect(screen.getByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Email address')).toBeOnTheScreen();
    expect(screen.getByLabelText('Password')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();
    // Two fields, not sign-up's three, and still only Google — the board draws no Apple button.
    expect(screen.queryByLabelText('Full name')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Continue with Apple')).not.toBeOnTheScreen();
    // And the stub's own copy is gone with it.
    expect(screen.queryByText(/design-gated/)).not.toBeOnTheScreen();
  });

  it('holds its errors back until a field is left or the button is pressed', async () => {
    await renderScreen();

    await type('Email address', '   ');
    expect(screen.queryByText('Add an email address.')).not.toBeOnTheScreen();

    await act(async () => fireEvent(screen.getByLabelText('Email address'), 'blur'));
    expect(screen.getByText('Add an email address.')).toBeOnTheScreen();
    expect(screen.queryByText('Enter your password.')).not.toBeOnTheScreen();
  });

  it('refuses an empty form and says so, without signing in', async () => {
    await renderScreen();

    await press('Sign In');

    expect(screen.getByText('Add an email address.')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password.')).toBeOnTheScreen();
    expect(screen.getByText('Fill in every field to continue.')).toBeOnTheScreen();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });

  it('takes any values at all and signs into the mock account', async () => {
    await renderScreen();

    // Deliberately junk: there is no identity provider, so nothing here is checked for shape.
    await type('Email address', 'not-an-address');
    await type('Password', 'x');
    await press('Sign In');

    expect(useSessionStore.getState().status).toBe('signed_in');
    expect(storage.get('prefs.session')).toBe('signed_in');
    // Signing in flips the root guard; the screen makes no navigation call of its own.
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    // And signing out later returns here rather than replaying the slides.
    expect(useOnboardingStore.getState().seen).toBe(true);
  });

  it('signs in through Google without filling the form', async () => {
    await renderScreen();

    await press('Continue with Google');

    expect(useSessionStore.getState().status).toBe('signed_in');
  });

  it('reveals and re-hides the password', async () => {
    await renderScreen();

    expect(screen.getByLabelText('Show password')).toBeOnTheScreen();
    await press('Show password');
    expect(screen.getByLabelText('Hide password')).toBeOnTheScreen();
  });

  it('asks the page to scroll each field clear of the keyboard', async () => {
    await renderScreen();

    // The reveal is what lifts a focused box above the keyboard, and it only happens because the
    // field opts in — the defect the first device pass hit on sign-up.
    for (const field of ['Email address', 'Password']) {
      expect(typeof screen.getByLabelText(field).props.onFocus).toBe('function');
    }
  });

  it('explains the reset it cannot perform rather than doing nothing', async () => {
    await renderScreen();

    expect(screen.queryByText(/single-use link/)).not.toBeOnTheScreen();

    await press('Forgot password?');

    // Says outright that there is no server behind it, instead of a tap that goes nowhere.
    expect(screen.getByText(/single-use link/)).toBeOnTheScreen();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });

  it('sends both ways out to the routes the board points at', async () => {
    await renderScreen();

    await press('Go back');
    expect(mockBack).toHaveBeenCalledTimes(1);

    // Replace, not push: sign-up pushes back here, so pushing both ways stacks the two forms
    // alternately for as long as the reader keeps tapping.
    await press('Don’t have an account? Create one');
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-up');
    expect(mockPush).not.toHaveBeenCalled();
  }, 60000);
});
