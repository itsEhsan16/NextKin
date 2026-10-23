import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { signInErrorMessage, SIGN_IN_FAILED, TOO_MANY_TRIES } from '@/features/auth/signInForm';
import { renderWithQuery } from '../../../testSupport/render';

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

describe('Web sign-in', () => {
  beforeEach(() => replace.mockClear());

  it('asks for both fields before signing in', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SignInScreen />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Add an email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(replace).not.toHaveBeenCalled();
  });

  it('opens the app on the mock with any details', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SignInScreen />);
    await user.type(screen.getByLabelText('Email address'), 'george.smith@gmail.com');
    await user.type(screen.getByLabelText('Password'), 'anything');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('shows and hides the password', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SignInScreen />);
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('marks the flows web has not built as unavailable', () => {
    renderWithQuery(<SignInScreen />);
    for (const name of ['Sign up', 'Forgot password?', 'Continue with Google']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('never says whether an account exists', () => {
    expect(signInErrorMessage({ code: 'UNAUTHENTICATED' })).toBe(SIGN_IN_FAILED);
    expect(signInErrorMessage({ code: 'RATE_LIMITED' })).toBe(TOO_MANY_TRIES);
  });
});
