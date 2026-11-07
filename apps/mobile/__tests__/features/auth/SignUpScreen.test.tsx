import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { SignUpScreen, useOnboardingStore, useSessionStore } from '@/features/auth';
import { storage } from '@/lib';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

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
      <SignUpScreen />
    </SafeAreaProvider>,
  );

const type = async (field: string, value: string) =>
  act(async () => fireEvent.changeText(screen.getByLabelText(field), value));

/** Create an account (Figma 307:4386). */
describe('SignUpScreen', () => {
  beforeEach(() => {
    storage.remove('prefs.session');
    storage.remove('prefs.onboardingSeen');
    useSessionStore.setState({ status: 'signed_out' });
    useOnboardingStore.setState({ seen: false });
    mockPush.mockClear();
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

    expect(screen.getByRole('header', { name: 'Create an account' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Full name')).toBeOnTheScreen();
    expect(screen.getByLabelText('Email address')).toBeOnTheScreen();
    expect(screen.getByLabelText('Password')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();
    // Only Google. The board draws no Apple button, whatever V2 §7.1 will eventually want.
    expect(screen.queryByLabelText('Continue with Apple')).not.toBeOnTheScreen();
  });

  it('holds its errors back until a field is left or the button is pressed', async () => {
    await renderScreen();

    await type('Full name', '   ');
    // Nothing yet — an error on the first keystroke reads as a telling-off.
    expect(screen.queryByText('Add your name.')).not.toBeOnTheScreen();

    await act(async () => fireEvent(screen.getByLabelText('Full name'), 'blur'));
    expect(screen.getByText('Add your name.')).toBeOnTheScreen();
    // Blurring one field says nothing about the two nobody has reached yet.
    expect(screen.queryByText('Add an email address.')).not.toBeOnTheScreen();
  });

  it('refuses an empty form and says so, without signing in', async () => {
    await renderScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Create account')));

    expect(screen.getByText('Add your name.')).toBeOnTheScreen();
    expect(screen.getByText('Add an email address.')).toBeOnTheScreen();
    expect(screen.getByText('Choose a password.')).toBeOnTheScreen();
    expect(screen.getByText('Fix the highlighted fields.')).toBeOnTheScreen();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });

  it('takes any well-formed details and signs into a fresh mock account (§172 rules)', async () => {
    await renderScreen();

    // Short but well-formed: since §172 the email shape and an 8-character password are checked.
    await type('Full name', 'qq');
    await type('Email address', 'qq@example.com');
    await type('Password', 'xxxxxxxx');
    await act(async () => fireEvent.press(screen.getByLabelText('Create account')));

    expect(useSessionStore.getState().status).toBe('signed_in');
    expect(storage.get('prefs.session')).toBe('signed_in');
    // Signing in flips the root guard; the screen makes no navigation call of its own.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('signs in through Google without filling the form', async () => {
    await renderScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Continue with Google')));

    expect(useSessionStore.getState().status).toBe('signed_in');
  });

  it('marks onboarding seen, so signing out does not replay the slides', async () => {
    await renderScreen();

    await type('Full name', 'Ada');
    await type('Email address', 'ada@example.com');
    await type('Password', 'hunter22');
    await act(async () => fireEvent.press(screen.getByLabelText('Create account')));

    expect(useOnboardingStore.getState().seen).toBe(true);
  });

  it('asks the page to scroll each field clear of the keyboard', async () => {
    await renderScreen();

    // The reveal is what lifts a focused box above the keyboard, and it only happens because the
    // field opts in: `useRevealOnFocus` is a context hook, so a control that simply forgets to
    // call it sits silently under the keyboard with every other test still green. That is the
    // defect the first device pass hit, and it is why AuthField has to keep this handler.
    for (const field of ['Full name', 'Email address', 'Password']) {
      expect(typeof screen.getByLabelText(field).props.onFocus).toBe('function');
    }
  });

  it('reveals and re-hides the password', async () => {
    await renderScreen();

    expect(screen.getByLabelText('Show password')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByLabelText('Show password')));
    expect(screen.getByLabelText('Hide password')).toBeOnTheScreen();
  });

  it('sends both ways out to the routes the board points at', async () => {
    await renderScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Go back')));
    expect(mockBack).toHaveBeenCalledTimes(1);

    await act(async () =>
      fireEvent.press(screen.getByLabelText('Already have an account? Sign in')),
    );
    // A replace, as the screen means it: one form swaps for the other in place.
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  }, 60000);
});
