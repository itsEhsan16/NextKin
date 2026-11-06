import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { SignInScreen, useSessionStore } from '@/features/auth';
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

const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SignInScreen />
    </SafeAreaProvider>,
  );

const type = async (field: string, value: string) =>
  act(async () => fireEvent.changeText(screen.getByLabelText(field), value));
const press = async (name: string) =>
  act(async () => fireEvent.press(screen.getByRole('button', { name })));

/** Sign in (toreview.md §172). */
describe('SignInScreen', () => {
  beforeEach(() => {
    storage.remove('prefs.session');
    useSessionStore.setState({ status: 'signed_out' });
    mockReplace.mockClear();
  });

  afterEach(async () => {
    await cleanup();
    storage.remove('prefs.session');
    useSessionStore.setState(SESSION, true);
  });

  it('shows two fields and one button', async () => {
    await renderScreen();
    expect(screen.getByRole('header', { name: 'Welcome back' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.getByLabelText('Password')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('refuses an empty form', async () => {
    await renderScreen();
    await press('Sign in');
    expect(screen.getByText('Add an email address.')).toBeOnTheScreen();
    expect(useSessionStore.getState().status).toBe('signed_out');
  });

  it('signs into the mock with any details', async () => {
    await renderScreen();
    await type('Email', 'robin@example.test');
    await type('Password', 'anything');
    await press('Sign in');
    expect(useSessionStore.getState().status).toBe('signed_in');
  });

  it('explains password reset plainly, with no spec talk', async () => {
    await renderScreen();
    await press('Forgot password?');
    expect(screen.getByText(/coming soon/)).toBeOnTheScreen();
    expect(screen.queryByText(/§/)).not.toBeOnTheScreen();
  });

  it('swaps to sign-up in place', async () => {
    await renderScreen();
    await press('Create account');
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-up');
  });
});
