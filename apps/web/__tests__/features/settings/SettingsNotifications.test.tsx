import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockStore, resetMockRepos } from '@nextkin/shared/repos';

import { NotificationPreferences } from '@/features/settings/components/NotificationPreferences';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { recordValues } from '../../../testSupport/recordValues';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

/**
 * A test that saves and then reads back makes several round trips through the mock layer's
 * 300–900ms latency, so those tests get more room than Jest's 5s default. Each also waits for its
 * own saves to land, so none is still on its way when the next test resets the store: one that
 * was, once, wrote itself into the next test (`toreview.md` §24.3).
 */
const ROUND_TRIPS_MS = 15_000;

/** Resolves once the notification settings have loaded; returns their card. */
const settle = () =>
  screen.findByRole(
    'region',
    { name: 'Notification preferences' },
    { timeout: SETTLE_MS.normal * 2 },
  );

const toggle = (name: string) => screen.getByRole('switch', { name });

const CHANNELS = ['In-app', 'Email', 'Push'] as const;

/** The board's topic switches, In-app / Email / Push (247:1339-1498). */
const BOARD: readonly (readonly [string, readonly [boolean, boolean, boolean]])[] = [
  ['Job matches', [true, true, true]],
  ['Application updates', [true, true, true]],
  ['Interview reminders', [true, true, true]],
  ['Resume insights', [true, true, false]],
  ['Product updates', [true, false, false]],
  ['Tips & recommendations', [true, true, false]],
  ['Account & security', [true, true, true]],
];

describe('SettingsScreen — Notifications (247:1094)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it("renders the board's header, its channels and its topics", async () => {
    renderWithQuery(<SettingsScreen initialSection="notifications" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
    expect(
      screen.getByText('Manage what you receive and stay updated on what matters most.'),
    ).toBeInTheDocument();
    const card = await settle();

    expect(
      within(card).getByText('Choose how and when you want to be notified.'),
    ).toBeInTheDocument();
    const channels = within(card).getByRole('list', { name: 'Channels' });
    for (const [name, line] of [
      ['In-app', 'Instant notifications'],
      ['Email', 'Important updates'],
      ['Push', 'On your device'],
    ] as const) {
      expect(within(channels).getByRole('switch', { name })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(within(channels).getByText(line)).toBeInTheDocument();
    }
    for (const [topic, states] of BOARD) {
      CHANNELS.forEach((channel, index) => {
        expect(toggle(`${topic}, ${channel}`)).toHaveAttribute(
          'aria-checked',
          String(states[index]),
        );
      });
    }
    expect(
      within(card).getByText(
        "You'll always receive critical account and security notifications, even if they're turned off.",
      ),
    ).toBeInTheDocument();
  });

  it(
    'saves a switch the moment it flips',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="notifications" />);
      await settle();

      await user.click(toggle('Product updates, Email'));
      expect(toggle('Product updates, Email')).toHaveAttribute('aria-checked', 'true');
      await waitFor(
        () => expect(mockStore.state.notificationSettings.topics.productUpdates.email).toBe(true),
        { timeout: SETTLE_MS.normal * 2 },
      );
    },
    ROUND_TRIPS_MS,
  );

  it(
    'keeps two quick flips, and neither flips back while the first one saves',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="notifications" />);
      await settle();
      const first = toggle('Resume insights, Push');
      const second = toggle('Tips & recommendations, Push');
      const shown = recordValues(() => second.getAttribute('aria-checked'));

      await user.click(first);
      await user.click(second);
      await waitFor(
        () => {
          const { topics } = mockStore.state.notificationSettings;
          expect([topics.resumeInsights.push, topics.tips.push]).toEqual([true, true]);
        },
        { timeout: SETTLE_MS.normal * 4 },
      );
      // Long enough for the refetch after the last save to land as well.
      await act(() => new Promise<void>((resolve) => setTimeout(resolve, SETTLE_MS.normal)));

      expect(shown.stop()).toEqual(['false', 'true']);
      expect(first).toHaveAttribute('aria-checked', 'true');
    },
    ROUND_TRIPS_MS,
  );

  it(
    "greys a channel's column while the channel is off, and keeps its switches",
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="notifications" />);
      const card = await settle();
      const push = within(within(card).getByRole('list', { name: 'Channels' })).getByRole(
        'switch',
        { name: 'Push' },
      );
      const pushChannel = () => mockStore.state.notificationSettings.channels.push;

      await user.click(push);
      expect(toggle('Job matches, Push')).toBeDisabled();
      expect(toggle('Job matches, Push')).toHaveAttribute('aria-checked', 'true');
      expect(toggle('Job matches, Email')).toBeEnabled();
      await waitFor(() => expect(pushChannel()).toBe(false), { timeout: SETTLE_MS.normal * 2 });

      await user.click(push);
      expect(toggle('Job matches, Push')).toBeEnabled();
      await waitFor(() => expect(pushChannel()).toBe(true), { timeout: SETTLE_MS.normal * 2 });
    },
    ROUND_TRIPS_MS,
  );

  it(
    'puts every switch back with Reset to default, even right after a change',
    async () => {
      const user = userEvent.setup();
      renderWithQuery(<SettingsScreen initialSection="notifications" />);
      await settle();
      const email = () => mockStore.state.notificationSettings.topics.jobMatches.email;

      await user.click(toggle('Job matches, Email'));
      expect(toggle('Job matches, Email')).toHaveAttribute('aria-checked', 'false');

      // Reset while that switch is still saving: the save must not land after the reset.
      await user.click(screen.getByRole('button', { name: 'Reset to default' }));
      // A flip made now would carry the old values and undo the reset, so the switches wait.
      expect(toggle('Push')).toBeDisabled();
      expect(toggle('Job matches, Push')).toBeDisabled();
      expect(
        await screen.findByRole(
          'switch',
          { name: 'Job matches, Email', checked: true },
          { timeout: SETTLE_MS.normal * 3 },
        ),
      ).toBeInTheDocument();
      await waitFor(() => expect(email()).toBe(true), { timeout: SETTLE_MS.normal * 3 });
      await waitFor(() => expect(toggle('Job matches, Push')).toBeEnabled(), {
        timeout: SETTLE_MS.normal * 2,
      });
    },
    ROUND_TRIPS_MS,
  );

  it(
    'shows its own loading and error states',
    async () => {
      const loading = renderWithQuery(<NotificationPreferences />);
      expect(screen.queryByRole('region', { name: 'Notification preferences' })).toBeNull();
      loading.unmount();

      renderWithQuery(<NotificationPreferences />, 'error');
      expect(
        await screen.findByText(
          "Couldn't load your notification settings",
          {},
          { timeout: SETTLE_MS.error },
        ),
      ).toBeInTheDocument();
    },
    ROUND_TRIPS_MS,
  );
});
