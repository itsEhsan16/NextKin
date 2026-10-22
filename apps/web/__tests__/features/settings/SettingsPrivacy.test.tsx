import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockStore, repos, resetMockRepos } from '@nextkin/shared/repos';

import { PrivacySection } from '@/features/settings/components/PrivacySection';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { recordValues } from '../../../testSupport/recordValues';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

/**
 * Saves and the data export run through the mock layer's 300–900ms latency, and the archive takes
 * 4s to build (`DATA_EXPORT_MS`) while the row polls every second.
 */
const ROUND_TRIPS_MS = 20_000;

/** Resolves once the cards have loaded (they arrive together); returns the settings card. */
const settle = () =>
  screen.findByRole('region', { name: 'Privacy settings' }, { timeout: SETTLE_MS.normal * 2 });

const card = (name: string) => screen.getByRole('region', { name });

/** Long enough for a late save, and the refetch after the last one, to land. */
const writesLand = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, SETTLE_MS.normal)));

/** A save that fails after a moment, so the value it showed first can be seen. */
const failsSoon = () =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Offline')), 300));

describe('SettingsScreen — Privacy & data (from the mockup)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the mockup's header and its three cards", async () => {
    renderWithQuery(<SettingsScreen initialSection="privacy" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy & data' })).toBeInTheDocument();
    expect(
      screen.getByText('Control your personal information, data usage, and privacy preferences.'),
    ).toBeInTheDocument();
    const privacy = await settle();

    expect(
      within(privacy).getByText('Manage how your information is used and who can see it.'),
    ).toBeInTheDocument();
    expect(
      within(privacy).getByRole('button', { name: 'Profile visibility: Visible to recruiters' }),
    ).toHaveAccessibleDescription(
      'Choose who can view your profile (recruiters, public, or private).',
    );
    for (const [name, on] of [
      ['Let recruiters find you', true],
      ['Show on search engines', false],
      ['Share anonymized data', true],
    ] as const) {
      expect(within(privacy).getByRole('switch', { name })).toHaveAttribute(
        'aria-checked',
        String(on),
      );
    }
    // Each control is described by its row's line.
    expect(
      within(privacy).getByRole('switch', { name: 'Show on search engines' }),
    ).toHaveAccessibleDescription(
      'Allow your profile to appear in Google and other search engines.',
    );

    const data = card('Your data');
    expect(
      within(data).getByText('Get a copy of your profile, resumes, and activity data.'),
    ).toBeInTheDocument();
    expect(within(data).getByRole('button', { name: 'Download data' })).toBeInTheDocument();
    expect(
      within(data).getByRole('button', { name: 'Manage data preferences' }),
    ).toBeInTheDocument();
    expect(within(data).getByRole('button', { name: 'Delete my data' })).toBeInTheDocument();

    const security = card('Security');
    expect(
      within(security).getByRole('button', { name: 'Enable two-factor authentication' }),
    ).toBeInTheDocument();
    expect(
      within(security).getByRole('button', { name: 'Active sessions' }),
    ).toHaveAccessibleDescription('Manage your logged-in devices.');
  });

  it(
    'saves each privacy setting the moment it changes, and neither control flips back',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="privacy" />);
      const privacy = await settle();
      const engines = within(privacy).getByRole('switch', { name: 'Show on search engines' });
      const visibility = within(privacy).getByRole('button', {
        name: 'Profile visibility: Visible to recruiters',
      });
      const shownEngines = recordValues(() => engines.getAttribute('aria-checked'));
      const shownVisibility = recordValues(() => visibility.getAttribute('aria-label'));
      const saved = () => {
        const { searchEngines, profileVisibility } = mockStore.state.privacySettings;
        return [searchEngines, profileVisibility];
      };

      // Both write the one set of settings, so the second save has to land after the first.
      await user.click(engines);
      expect(engines).toHaveAttribute('aria-checked', 'true');
      await user.click(visibility);
      await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Private' }));
      await waitFor(() =>
        expect(visibility).toHaveAttribute('aria-label', 'Profile visibility: Private'),
      );
      await waitFor(() => expect(saved()).toEqual([true, 'private']), {
        timeout: SETTLE_MS.normal * 4,
      });
      await writesLand();

      expect(saved()).toEqual([true, 'private']);
      expect(shownEngines.stop()).toEqual(['false', 'true']);
      expect(shownVisibility.stop()).toEqual([
        'Profile visibility: Visible to recruiters',
        'Profile visibility: Private',
      ]);
    },
    ROUND_TRIPS_MS,
  );

  it(
    'puts a switch back when its save fails',
    async () => {
      jest.spyOn(repos.user, 'updatePrivacySettings').mockImplementationOnce(failsSoon);
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="privacy" />);
      const engines = within(await settle()).getByRole('switch', {
        name: 'Show on search engines',
      });

      await user.click(engines);
      expect(engines).toHaveAttribute('aria-checked', 'true');
      await waitFor(() => expect(engines).toHaveAttribute('aria-checked', 'false'));
      await writesLand();

      expect(engines).toHaveAttribute('aria-checked', 'false');
      expect(mockStore.state.privacySettings.searchEngines).toBe(false);
    },
    ROUND_TRIPS_MS,
  );

  it(
    'builds the data export from the Download row and says when it is ready',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="privacy" />);
      await settle();
      const data = card('Your data');

      const download = within(data).getByRole('button', { name: 'Download data' });
      await user.click(download);
      expect(
        await within(data).findByText('Preparing your archive…', {}, { timeout: 3000 }),
      ).toBeInTheDocument();
      // It keeps focus while the archive builds: `aria-disabled`, not `disabled`.
      expect(download).toHaveAttribute('aria-disabled', 'true');
      expect(download).toHaveFocus();
      expect(
        await within(data).findByText(
          /^nextkin-export\.json · 4\.2 MB is ready/,
          {},
          { timeout: 12_000 },
        ),
      ).toBeInTheDocument();
      expect(within(data).getByRole('button', { name: 'Prepare a new copy' })).toHaveAttribute(
        'aria-disabled',
        'false',
      );
    },
    ROUND_TRIPS_MS,
  );

  it('says when the archive failed, and offers it again', async () => {
    mockStore.state.dataExport = {
      status: 'failed',
      requestedAt: new Date().toISOString(),
      error: 'The archive timed out.',
    };
    renderWithQuery(<SettingsScreen initialSection="privacy" />);
    await settle();
    const data = card('Your data');

    expect(
      await within(data).findByText(
        'The archive timed out.',
        {},
        { timeout: SETTLE_MS.normal * 2 },
      ),
    ).toBeInTheDocument();
    expect(within(data).getByRole('button', { name: 'Download data' })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
  });

  it('opens the Account section from Active sessions, with focus on the devices', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SettingsScreen initialSection="privacy" />);
    await settle();

    await user.click(within(card('Security')).getByRole('button', { name: 'Active sessions' }));
    expect(screen.getByRole('tab', { name: 'Account', selected: true })).toBeInTheDocument();
    const devices = await screen.findByRole(
      'list',
      { name: 'Signed-in devices' },
      { timeout: SETTLE_MS.normal * 2 },
    );
    // The button pressed went with Privacy & data, so focus goes on to the devices it named.
    await waitFor(() => expect(devices).toHaveFocus());
  });

  it('shows its own loading state, and an error only where the settings go', async () => {
    const { security } = mockStore.state;
    const loading = renderWithQuery(
      <PrivacySection security={security} onOpenAccount={() => {}} />,
    );
    // The cards arrive together: while the settings load there is no card, and no error.
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByText("Couldn't load your privacy settings")).toBeNull();
    loading.unmount();

    renderWithQuery(<PrivacySection security={security} onOpenAccount={() => {}} />, 'error');
    expect(
      await screen.findByText(
        "Couldn't load your privacy settings",
        {},
        { timeout: SETTLE_MS.error },
      ),
    ).toBeInTheDocument();
    // Only the settings failed: the export and the security, which load elsewhere, stay.
    expect(screen.queryByRole('region', { name: 'Privacy settings' })).toBeNull();
    expect(card('Your data')).toBeInTheDocument();
    expect(card('Security')).toBeInTheDocument();
  });
});
