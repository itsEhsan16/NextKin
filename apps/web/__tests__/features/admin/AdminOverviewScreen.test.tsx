import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ADMIN_ROLE_PERMISSIONS } from '@nextkin/shared/models';
import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { NeedsAttentionCard } from '@/features/admin/overview/components/NeedsAttentionCard';
import { AdminOverviewScreen } from '@/features/admin/screens/AdminOverviewScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: jest.fn() }),
}));

const wait = { timeout: SETTLE_MS.normal * 3 };

describe('AdminOverviewScreen (Figma 394:536)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('greets the staff member and draws the board’s headline figures', async () => {
    renderWithQuery(<AdminOverviewScreen />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome back, Ehsan' }, wait),
    ).toBeInTheDocument();

    // The card is redrawn when its figures replace the skeleton, so find it by its figure first.
    await screen.findByText('2,418', {}, wait);
    const signups = screen.getByRole('region', { name: 'New signups' });
    expect(within(signups).getByText('12.4%')).toBeInTheDocument();
    expect(within(signups).getByText('vs last 30 days')).toBeInTheDocument();

    const reliability = screen.getByRole('region', { name: 'Generation reliability' });
    expect(within(reliability).getByText('97.6%')).toBeInTheDocument();
    expect(within(reliability).getByText('0.4 pts')).toBeInTheDocument();
    expect(within(reliability).getByText('target 98%')).toBeInTheDocument();

    for (const name of [
      'Activation rate',
      'Free → Pro conversion',
      'AI generations',
      'Needs attention',
      'Pipeline health',
      'AI cost',
      'Pro subscriptions',
      'ATS score distribution',
      'Job providers',
      'Recent admin activity',
    ]) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  it('narrows AI generations to one kind', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AdminOverviewScreen />);

    const card = await screen.findByRole('region', { name: 'AI generations' }, wait);
    expect(await within(card).findByText('18,904', {}, wait)).toBeInTheDocument();
    expect(within(card).getByText('461 failed (2.4%) · p95 run time 41s')).toBeInTheDocument();

    await user.click(within(card).getByRole('radio', { name: 'Tailor' }));
    expect(within(card).getByText('5,671')).toBeInTheDocument();
    expect(within(card).getByRole('radio', { name: 'Tailor' })).toBeChecked();
  });

  it('opens a day’s breakdown when its column is focused', async () => {
    renderWithQuery(<AdminOverviewScreen />);

    const card = await screen.findByRole('region', { name: 'AI generations' }, wait);
    const day = await within(card).findByRole('listitem', { name: /813 runs, 9 failed/ }, wait);
    act(() => day.focus());

    const tooltip = within(card).getByRole('tooltip');
    expect(within(tooltip).getByText(/813 runs/)).toBeInTheDocument();
    expect(within(tooltip).getByText('276')).toBeInTheDocument();
    expect(within(tooltip).getByText('9 · 1.1%')).toBeInTheDocument();
  });

  it('says what a score band holds when it is focused', async () => {
    renderWithQuery(<AdminOverviewScreen />);

    const card = await screen.findByRole('region', { name: 'ATS score distribution' }, wait);
    const band = await within(card).findByRole('listitem', { name: /Score 70–80/ }, wait);
    expect(band).toHaveAccessibleName('Score 70–80: 1,490 checks, 27%');
    act(() => band.focus());

    const tooltip = within(card).getByRole('tooltip');
    expect(within(tooltip).getByText('Score 70–80')).toBeInTheDocument();
    expect(within(tooltip).getByText('1,490')).toBeInTheDocument();
    act(() => band.blur());
    expect(within(card).queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('puts a currency’s own figure in the donut while its legend row is hovered', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AdminOverviewScreen />);

    const card = await screen.findByRole('region', { name: 'Pro subscriptions' }, wait);
    expect(await within(card).findByText('per month', {}, wait)).toBeInTheDocument();
    const euro = within(card).getByText('€1,320');
    await user.hover(euro);
    // The middle now names the euro figure too.
    expect(within(card).getAllByText('€1,320')).toHaveLength(2);
    expect(within(card).queryByText('per month')).not.toBeInTheDocument();
    await user.unhover(euro);
    expect(within(card).getByText('per month')).toBeInTheDocument();
  });

  it('names a cost stage over the meter while its row is hovered', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AdminOverviewScreen />);

    const card = await screen.findByRole('region', { name: 'AI cost' }, wait);
    await user.hover(await within(card).findByText('Structure JD', {}, wait));
    expect(within(card).getByText('· $231 · 18%', { exact: false })).toBeInTheDocument();
  });

  it('lists the queues and masks every audit target', async () => {
    renderWithQuery(<AdminOverviewScreen />);

    const attention = await screen.findByRole('region', { name: 'Needs attention' }, wait);
    expect(await within(attention).findByText('30 open', {}, wait)).toBeInTheDocument();
    expect(within(attention).getByRole('link', { name: /Generation failures/ })).toHaveAttribute(
      'href',
      '/admin/failures',
    );
    expect(within(attention).getByRole('link', { name: /Technology KB review/ })).toHaveAttribute(
      'href',
      '/admin/technologies/review',
    );

    const activity = screen.getByRole('region', { name: 'Recent admin activity' });
    expect(await within(activity).findByText('user ···4f2a', {}, wait)).toBeInTheDocument();
    expect(within(activity).queryByText(/usr_8d1c4f2a/)).not.toBeInTheDocument();
  });

  it('searches recent activity', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AdminOverviewScreen />);

    const activity = await screen.findByRole('region', { name: 'Recent admin activity' }, wait);
    await within(activity).findByText('Sent a password reset', {}, wait);
    await user.type(within(activity).getByRole('searchbox'), 'curator');

    expect(
      await within(activity).findByText('Approved KB change: Next.js 15 release date', {}, wait),
    ).toBeInTheDocument();
    await waitFor(
      () => expect(within(activity).queryByText('Sent a password reset')).not.toBeInTheDocument(),
      wait,
    );
  });

  it('shows each card’s empty state, with no figure the empty platform contradicts', async () => {
    renderWithQuery(<AdminOverviewScreen />, 'empty');

    const generations = await screen.findByRole('region', { name: 'AI generations' }, wait);
    expect(await within(generations).findByText('No runs yet', {}, wait)).toBeInTheDocument();
    // No growth figure or run time beside zero runs.
    expect(within(generations).queryByText('9.1%')).not.toBeInTheDocument();
    expect(within(generations).queryByText(/p95/)).not.toBeInTheDocument();

    for (const name of ['Activation rate', 'Generation reliability', 'Free → Pro conversion']) {
      const card = screen.getByRole('region', { name });
      expect(within(card).getByText('Nothing to measure yet')).toBeInTheDocument();
    }
    expect(
      within(screen.getByRole('region', { name: 'AI cost' })).getByText('No model calls yet'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Pro subscriptions' })).getByText('No revenue yet'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Pipeline health' })).getAllByText('no runs yet'),
    ).toHaveLength(2);
    expect(
      await within(screen.getByRole('region', { name: 'Needs attention' })).findByText(
        'All clear',
        {},
        wait,
      ),
    ).toBeInTheDocument();
    expect(
      await within(screen.getByRole('region', { name: 'Recent admin activity' })).findByText(
        'No staff activity yet',
        {},
        wait,
      ),
    ).toBeInTheDocument();
  });

  it('leaves the activity rows out for a role that can’t read the audit log', async () => {
    jest.spyOn(repos.admin, 'me').mockResolvedValue({
      userId: 'usr_staff_marco',
      name: 'Marco K.',
      email: 'marco@nextkin.ai',
      role: 'curator',
      permissions: [...ADMIN_ROLE_PERMISSIONS.curator],
    });
    const activity = jest.spyOn(repos.admin, 'activity');
    renderWithQuery(<AdminOverviewScreen />);

    await screen.findByRole('heading', { level: 1, name: 'Welcome back, Marco K.' }, wait);
    expect(screen.queryByRole('region', { name: 'Recent admin activity' })).not.toBeInTheDocument();
    expect(activity).not.toHaveBeenCalled();
  });

  it('offers a retry when the figures fail', async () => {
    renderWithQuery(<AdminOverviewScreen />, 'error');

    expect(
      await screen.findByText('Couldn’t load the Overview', {}, { timeout: SETTLE_MS.error * 3 }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
  });
});

describe('NeedsAttentionCard', () => {
  it('names the queues the source doesn’t count instead of calling them all clear', () => {
    renderWithQuery(
      <NeedsAttentionCard
        queues={[
          { key: 'kbReview', count: 0, detail: 'Diffs waiting for approve or reject' },
          { key: 'promptDrafts', count: 0, detail: 'Need a passing eval to publish' },
        ]}
        permissions={ADMIN_ROLE_PERMISSIONS.super_admin}
        loading={false}
        error={false}
        onRetry={() => {}}
      />,
    );
    expect(screen.queryByText('All clear')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing open')).toBeInTheDocument();
    expect(screen.getByText('Not connected yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Generation failures, Deletion requests, Abuse reports/),
    ).toBeInTheDocument();
  });

  it('leaves out a queue the role can’t open', () => {
    renderWithQuery(
      <NeedsAttentionCard
        queues={[{ key: 'kbReview', count: 4, detail: 'Diffs waiting for approve or reject' }]}
        permissions={ADMIN_ROLE_PERMISSIONS.curator}
        loading={false}
        error={false}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole('link', { name: /Technology KB review/ })).toBeInTheDocument();
    // A curator opens no People or Trust pages, so those queues aren't named as missing.
    expect(screen.queryByText(/Deletion requests/)).not.toBeInTheDocument();
  });
});
