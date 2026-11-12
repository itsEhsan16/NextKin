import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

/** The Account section (254:326) and the section list; Preferences has its own suite. */

const SECTIONS = [
  'Account',
  'Preferences',
  'Notifications',
  'Privacy & data',
  'Connected accounts',
  'Billing & plan',
  'Security',
  'Delete account',
];

/** Resolves once the account has loaded. */
const settle = () =>
  screen.findByRole('region', { name: 'Account information' }, { timeout: SETTLE_MS.normal * 2 });

/** Resolves once Security's devices have loaded: the list is the last to draw. */
const devicesLoaded = () =>
  screen.findByRole('list', { name: 'Signed-in devices' }, { timeout: SETTLE_MS.normal * 2 });

const card = (name: string) => screen.getByRole('region', { name });

const pageTitle = (name: string) => screen.getByRole('heading', { level: 1, name });

/** The value beside a label in one of the cards' rows (`dt` → `dd`). */
const valueOf = (region: HTMLElement, label: string) =>
  within(region).getByText(label).nextElementSibling;

describe('SettingsScreen', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('renders the board copy and its eight sections', () => {
    renderWithQuery(<SettingsScreen />);

    expect(pageTitle('Account settings')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Manage your account, security, and preferences to keep your NextKin experience safe and personalized.',
      ),
    ).toBeInTheDocument();
    for (const name of SECTIONS) expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Account', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Security' })).toHaveAccessibleDescription(
      'Two-factor auth, sessions',
    );
  });

  it('shows the loading state before the mock layer settles', () => {
    renderWithQuery(<SettingsScreen />);
    expect(screen.queryByRole('region', { name: 'Account information' })).not.toBeInTheDocument();
  });

  it('fills the Account section with the signed-in account', async () => {
    renderWithQuery(<SettingsScreen />);
    await settle();

    const info = card('Account information');
    expect(valueOf(info, 'Full name')).toHaveTextContent('George Smith');
    expect(valueOf(info, 'Email address')).toHaveTextContent('george.smith@gmail.com');
    expect(within(info).getByText('Verified')).toBeInTheDocument();
    expect(valueOf(info, 'Phone number')).toHaveTextContent('+91 98765 43210');
    expect(valueOf(info, 'Location')).toHaveTextContent('Bengaluru, India');
    expect(
      within(info).getByRole('button', { name: 'Edit account information' }),
    ).toBeInTheDocument();

    // Password, two-factor and devices live in Security only (redesign R7b, ST-03).
    expect(screen.queryByRole('region', { name: 'Password' })).toBeNull();
    expect(
      within(card('Password, two-factor and devices')).getByRole('button', {
        name: 'Open Security',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the password and two-factor in Security', async () => {
    renderWithQuery(<SettingsScreen initialSection="security" />);
    await devicesLoaded();

    const password = card('Password');
    expect(valueOf(password, 'Last changed')).toHaveTextContent('Jan 14, 2024');
    expect(within(password).getByRole('button', { name: 'Change password' })).toBeInTheDocument();

    const twoFactor = card('Two-factor authentication');
    expect(
      within(twoFactor).getByText(
        'Protect your account with 2FA to keep your data safe, even if your password is compromised.',
      ),
    ).toBeInTheDocument();
    expect(
      within(twoFactor).getByRole('button', { name: 'Enable two-factor authentication' }),
    ).toBeInTheDocument();
  });

  it('goes from Account to Security from the link card', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SettingsScreen />);
    await settle();
    await user.click(screen.getByRole('button', { name: 'Open Security' }));
    expect(screen.getByRole('tab', { name: 'Security', selected: true })).toBeInTheDocument();
  });

  it('lists the signed-in devices, this one first', async () => {
    renderWithQuery(<SettingsScreen initialSection="security" />);
    const devices = await devicesLoaded();

    const rows = within(devices).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    for (const [row, texts] of [
      [rows[0], ['Mac • Chrome', 'Bengaluru, India', 'Current session']],
      [rows[1], ['iPhone • Safari', 'Bengaluru, India', 'Last active 3 days ago']],
      [rows[2], ['Windows • Edge', 'New Delhi, India', 'Last active 1 week ago']],
    ] as const) {
      for (const text of texts) expect(row).toHaveTextContent(text);
    }
    // Only the other devices carry a menu.
    expect(within(devices).getAllByRole('button', { name: /^Options for/ })).toHaveLength(2);
    expect(
      within(card('Active sessions')).getByRole('button', { name: 'View all sessions' }),
    ).toBeInTheDocument();
  });

  it('switches to another section, and goes back', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SettingsScreen />);
    await settle();

    await user.click(screen.getByRole('tab', { name: 'Security' }));
    expect(screen.getByRole('tab', { name: 'Security', selected: true })).toBeInTheDocument();
    expect(pageTitle('Security')).toBeInTheDocument();
    expect(card('Security checkup')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Account information' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Account' }));
    expect(pageTitle('Account settings')).toBeInTheDocument();
    expect(card('Account information')).toBeInTheDocument();
  });

  it('opens Security (554:4027) on arrival: the checkup, then the three cards', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SettingsScreen initialSection="security" />);
    await devicesLoaded();

    expect(screen.getByRole('tab', { name: 'Security', selected: true })).toBeInTheDocument();
    expect(
      screen.getByText("Manage your password, two-factor sign-in, and where you're signed in."),
    ).toBeInTheDocument();
    const checkup = card('Security checkup');
    // The password (Jan 14, 2024) is over a year old: one to review. Two-factor is off but can't
    // be turned on yet, so it isn't counted (ST-18).
    expect(within(checkup).getByText('1 to review')).toBeInTheDocument();
    expect(within(checkup).getByText('Not available yet')).toBeInTheDocument();
    expect(within(checkup).getByText('Off')).toBeInTheDocument();
    expect(within(checkup).getByText('3 devices')).toBeInTheDocument();
    expect(within(checkup).getByText('This device and 2 others')).toBeInTheDocument();
    expect(card('Password')).toBeInTheDocument();
    expect(
      within(card('Two-factor authentication')).getByRole('button', {
        name: 'Enable two-factor authentication',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign out of other devices' }));
    await waitFor(
      () =>
        expect(
          within(screen.getByRole('list', { name: 'Signed-in devices' })).getAllByRole('listitem'),
        ).toHaveLength(1),
      { timeout: SETTLE_MS.normal * 3 },
    );
  });

  it('says so when no device is signed in', async () => {
    renderWithQuery(<SettingsScreen initialSection="security" />, 'empty');

    expect(
      await screen.findByText('No active sessions', {}, { timeout: SETTLE_MS.empty * 3 }),
    ).toBeInTheDocument();
  });

  it('shows the page-level error state when the account fails to load', async () => {
    renderWithQuery(<SettingsScreen />, 'error');

    expect(
      await screen.findByText('Something went wrong', {}, { timeout: SETTLE_MS.error }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
