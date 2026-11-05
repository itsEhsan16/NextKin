import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { AdminSignInScreen } from '@/features/admin/signin/AdminSignInScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ replace }),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };

describe('AdminSignInScreen (Figma 410:1605)', () => {
  beforeEach(() => {
    resetMockRepos();
    replace.mockClear();
  });

  async function toCodeStep() {
    const user = userEvent.setup();
    renderWithQuery(<AdminSignInScreen />);
    await user.type(screen.getByLabelText('Email'), 'ehsan@nextkin.ai');
    await user.type(screen.getByLabelText('Password'), 'NextKin-local-2026');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('heading', { name: 'Two-step verification' }, wait),
    ).toBeInTheDocument();
    return user;
  }

  it('asks for the password first, then the code', async () => {
    await toCodeStep();
    expect(
      screen.getByText('Enter the 6-digit code from your authenticator app for ehsan@nextkin.ai.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('moves along the boxes as the code is typed, and signs in when it is whole', async () => {
    const user = await toCodeStep();
    await user.type(screen.getByLabelText('Digit 1 of 6'), '472003');
    expect(screen.getByLabelText('Digit 6 of 6')).toHaveValue('3');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin'), wait);
  });

  it('fills every box from a pasted code', async () => {
    await toCodeStep();
    fireEvent.paste(screen.getByLabelText('Digit 1 of 6'), {
      clipboardData: { getData: () => '123456' },
    });
    expect(screen.getByLabelText('Digit 4 of 6')).toHaveValue('4');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin'), wait);
  });

  it('needs both an email and a password', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AdminSignInScreen />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your staff email and password.');
  });

  it('signs in with a backup code', async () => {
    const user = await toCodeStep();
    await user.click(screen.getByRole('button', { name: 'Use a backup code' }));
    await user.type(screen.getByLabelText('Backup code'), '4f2a-9c10');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin'), wait);
  });

  it('keeps focus in the boxes while a code is checked', async () => {
    const user = await toCodeStep();
    await user.type(screen.getByLabelText('Digit 1 of 6'), '472003');
    expect(screen.getByLabelText('Digit 6 of 6')).not.toBeDisabled();
    expect(screen.getByLabelText('Digit 6 of 6')).toHaveFocus();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin'), wait);
  });

  it('goes back to the password step', async () => {
    const user = await toCodeStep();
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('heading', { name: 'Staff sign-in' })).toBeInTheDocument();
  });

  it('walks a new account through the authenticator, its backup codes and a new password', async () => {
    // The mock's new accounts are emails starting "new" (toreview §171.13).
    const user = userEvent.setup();
    renderWithQuery(<AdminSignInScreen />);
    await user.type(screen.getByLabelText('Email'), 'new.member@nextkin.ai');
    await user.type(screen.getByLabelText('Password'), 'temporary-pass');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByRole('heading', { name: 'Set up your authenticator' }, wait),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /QR code/ })).toBeInTheDocument();
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Digit 1 of 6'), '472003');

    expect(
      await screen.findByRole('heading', { name: 'Save your backup codes' }, wait),
    ).toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /saved these codes/ }));
    await user.click(next);

    expect(screen.getByRole('heading', { name: 'Choose your password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'too short');
    await user.type(screen.getByLabelText('Confirm new password'), 'too short');
    await user.click(screen.getByRole('button', { name: 'Set password and sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 12 characters.');

    await user.clear(screen.getByLabelText('New password'));
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('New password'), 'a long staff passphrase');
    await user.type(screen.getByLabelText('Confirm new password'), 'a long staff passphrase');
    await user.click(screen.getByRole('button', { name: 'Set password and sign in' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin'), wait);
  });
});
