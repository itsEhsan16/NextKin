import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockStore, repos, resetMockRepos } from '@nextkin/shared/repos';

import { ConnectedAccountsSection } from '@/features/settings/components/ConnectedAccountsSection';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

/** Linking and unlinking each run through the mock layer's 300–900ms latency and a refetch. */
const ROUND_TRIPS_MS = 15_000;

/** Resolves once the accounts have loaded; returns their card. */
const settle = () =>
  screen.findByRole('region', { name: 'Connected accounts' }, { timeout: SETTLE_MS.normal * 2 });

const google = () => mockStore.state.connectedAccounts.find((a) => a.provider === 'google');

/**
 * The words a button shows. Its idle and busy labels share one cell so it keeps its width
 * (`StableLabel`); the one not showing is hidden from assistive tech.
 */
const shownLabel = (button: HTMLElement) =>
  [...button.querySelectorAll('span span')]
    .filter((label) => !label.closest('[aria-hidden="true"]'))
    .map((label) => label.textContent)
    .join('');

describe('SettingsScreen — Connected accounts (from the mockup, Google only)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the header, Google's row and the note", async () => {
    renderWithQuery(<SettingsScreen initialSection="connected" />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Connected accounts' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Connect your accounts to import data, automate your profile, and get a better experience.',
      ),
    ).toBeInTheDocument();
    const section = await settle();

    expect(
      within(section).getByText('Link your accounts to sync data and unlock more features.'),
    ).toBeInTheDocument();
    // One row: `getByRole` fails on a second.
    const row = within(within(section).getByRole('list', { name: 'Sign-in accounts' })).getByRole(
      'listitem',
    );
    expect(within(row).getByText('Google')).toBeInTheDocument();
    expect(within(row).getByText('Use Google to sign in and sync your data.')).toBeInTheDocument();
    expect(within(row).getByText('Not connected')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Connect Google' })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
    // By the user's call the page follows V2 §7.1, not the mockup's other five providers.
    for (const name of ['LinkedIn', 'GitHub', 'Microsoft', 'X (Twitter)', 'Slack']) {
      expect(within(section).queryByText(name)).not.toBeInTheDocument();
    }

    // The sign-in status under the provider (554:3547).
    expect(within(row).getByText('Sign in with Google')).toBeInTheDocument();
    expect(
      within(row).getByText('You sign in with your email and password today.'),
    ).toBeInTheDocument();

    // The note became its own card, "How connecting works" (577:2408).
    const how = screen.getByRole('region', { name: 'How connecting works' });
    expect(within(how).getByText('We only access the information you permit.')).toBeInTheDocument();
    expect(within(how).getByText('One account, two ways in')).toBeInTheDocument();
    expect(within(how).getByText('You stay in control')).toBeInTheDocument();
    expect(
      within(how).getByRole('link', { name: 'Learn more about how we use your data.' }),
    ).toHaveAttribute('href', '/help');
    expect(within(how).getByRole('link', { name: 'View privacy policy' })).toHaveAttribute(
      'href',
      '/help',
    );
  });

  it(
    'connects Google, then disconnects it',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="connected" />);
      const section = await settle();

      const connect = within(section).getByRole('button', { name: 'Connect Google' });
      await user.click(connect);
      // It keeps focus while it works: `aria-disabled`, not `disabled`, which drops focus.
      expect(connect).toHaveAttribute('aria-disabled', 'true');
      expect(shownLabel(connect)).toBe('Connecting…');
      expect(connect).toHaveFocus();
      expect(
        await within(section).findByText('Connected', {}, { timeout: SETTLE_MS.normal * 3 }),
      ).toBeInTheDocument();
      expect(google()?.connected).toBe(true);
      // Connect went away, so focus follows to what took its place.
      await waitFor(() =>
        expect(within(section).getByRole('button', { name: 'Manage Google' })).toHaveFocus(),
      );

      await user.click(within(section).getByRole('button', { name: 'More options for Google' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Disconnect Google' }));
      expect(
        await within(section).findByText('Not connected', {}, { timeout: SETTLE_MS.normal * 3 }),
      ).toBeInTheDocument();
      await waitFor(() => expect(google()?.connected).toBe(false), {
        timeout: SETTLE_MS.normal * 3,
      });
      await waitFor(() =>
        expect(within(section).getByRole('button', { name: 'Connect Google' })).toHaveFocus(),
      );
    },
    ROUND_TRIPS_MS,
  );

  it(
    'leaves Google unlinked, with Connect ready and focused, when linking fails',
    async () => {
      jest
        .spyOn(repos.user, 'connectAccount')
        .mockImplementationOnce(
          () =>
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Refused')), 300)),
        );
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="connected" />);
      const section = await settle();

      const connect = within(section).getByRole('button', { name: 'Connect Google' });
      await user.click(connect);
      expect(connect).toHaveAttribute('aria-disabled', 'true');
      await waitFor(() => expect(connect).toHaveAttribute('aria-disabled', 'false'));
      // And the refetch after the failure.
      await act(() => new Promise<void>((resolve) => setTimeout(resolve, SETTLE_MS.normal)));

      // No message says it failed: the row just stays as it was (`toreview.md` §30).
      expect(shownLabel(connect)).toBe('Connect');
      expect(connect).toHaveFocus();
      expect(within(section).getByText('Not connected')).toBeInTheDocument();
      expect(google()?.connected).toBe(false);
    },
    ROUND_TRIPS_MS,
  );

  it(
    'shows its own loading, empty and error states',
    async () => {
      const loading = renderWithQuery(<ConnectedAccountsSection />);
      expect(screen.queryByRole('region', { name: 'Connected accounts' })).toBeNull();
      expect(screen.queryByText('No accounts to connect')).toBeNull();
      expect(screen.queryByText("Couldn't load your connected accounts")).toBeNull();
      loading.unmount();

      const empty = renderWithQuery(<ConnectedAccountsSection />, 'empty');
      expect(
        await screen.findByText('No accounts to connect', {}, { timeout: SETTLE_MS.empty * 3 }),
      ).toBeInTheDocument();
      empty.unmount();

      renderWithQuery(<ConnectedAccountsSection />, 'error');
      expect(
        await screen.findByText(
          "Couldn't load your connected accounts",
          {},
          { timeout: SETTLE_MS.error },
        ),
      ).toBeInTheDocument();
    },
    ROUND_TRIPS_MS,
  );
});
