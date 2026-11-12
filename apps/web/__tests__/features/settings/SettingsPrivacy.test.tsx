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
    // Nothing behind it yet, so no chevron that looks like a link (ST-04); deleting is one place,
    // the Delete account section (ST-19).
    expect(within(data).queryByRole('button', { name: 'Manage data preferences' })).toBeNull();
    expect(within(data).getByRole('button', { name: 'Delete account' })).toBeInTheDocument();

    // Two-factor and devices are in Security only (ST-03).
    expect(
      within(card('Password, two-factor and devices')).getByRole('button', {
        name: 'Open Security',
      }),
    ).toBeInTheDocument();
  });

  it(
    'saves the analytics opt-out the moment it changes, and shows the rest as coming',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="privacy" />);
      const privacy = await settle();
      // Nothing reads these in Release 1 (V2 §6.2): shown, off, "Soon" (redesign R7b, ST-05).
      expect(
        within(privacy).getByRole('switch', { name: 'Show on search engines' }),
      ).toBeDisabled();
      expect(
        within(privacy).getByRole('button', { name: 'Profile visibility: Visible to recruiters' }),
      ).toBeDisabled();

      const share = within(privacy).getByRole('switch', { name: 'Share anonymized data' });
      const shown = recordValues(() => share.getAttribute('aria-checked'));
      await user.click(share);
      expect(share).toHaveAttribute('aria-checked', 'false');
      await waitFor(() => expect(mockStore.state.privacySettings.shareAnonymizedData).toBe(false), {
        timeout: SETTLE_MS.normal * 4,
      });
      // It says so (ST-06).
      expect(await within(privacy).findByText('Saved', {}, { timeout: 3000 })).toBeInTheDocument();
      await writesLand();
      expect(shown.stop()).toEqual(['true', 'false']);
    },
    ROUND_TRIPS_MS,
  );

  it(
    'puts a switch back when its save fails',
    async () => {
      jest.spyOn(repos.user, 'updatePrivacySettings').mockImplementationOnce(failsSoon);
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="privacy" />);
      const share = within(await settle()).getByRole('switch', {
        name: 'Share anonymized data',
      });

      await user.click(share);
      expect(share).toHaveAttribute('aria-checked', 'false');
      await waitFor(() => expect(share).toHaveAttribute('aria-checked', 'true'));
      await writesLand();

      expect(share).toHaveAttribute('aria-checked', 'true');
      expect(mockStore.state.privacySettings.shareAnonymizedData).toBe(true);
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

  it('opens Security from its link card, with focus on its tab', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SettingsScreen initialSection="privacy" />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'Open Security' }));
    const tab = screen.getByRole('tab', { name: 'Security', selected: true });
    await waitFor(() => expect(tab).toHaveFocus());
  });

  it('shows its own loading state, and an error only where the settings go', async () => {
    const { security } = mockStore.state;
    const loading = renderWithQuery(
      <PrivacySection security={security} onOpenSecurity={() => {}} onOpenDelete={() => {}} />,
    );
    // The cards arrive together: while the settings load there is no card, and no error.
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByText("Couldn't load your privacy settings")).toBeNull();
    loading.unmount();

    renderWithQuery(
      <PrivacySection security={security} onOpenSecurity={() => {}} onOpenDelete={() => {}} />,
      'error',
    );
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
    expect(card('Password, two-factor and devices')).toBeInTheDocument();
  });
});
