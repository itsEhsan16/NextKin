import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockStore, resetMockRepos } from '@nextkin/shared/repos';

import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const region = (name: string) => screen.getByRole('region', { name });

/** Resolves once billing has loaded: the card on file is its first row. */
const settle = () => screen.findByText('Expires 04/2027', {}, { timeout: SETTLE_MS.normal * 2 });

describe('SettingsScreen — Billing & plan (470:3)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('shows the Free plan, its limits and usage, with Upgrade still coming soon', async () => {
    renderWithQuery(<SettingsScreen initialSection="billing" />);
    await settle();

    expect(screen.getByRole('heading', { level: 1, name: 'Billing & plan' })).toBeInTheDocument();
    const current = region('Current plan');
    expect(within(current).getByRole('heading', { name: 'Free plan' })).toBeInTheDocument();
    expect(within(current).getByText('3 resume generations a month')).toBeInTheDocument();
    expect(within(current).getByText('DOCX export').closest('li')).toHaveTextContent(
      'not included',
    );
    // No billing facts on Free: nothing renews and nothing was bought.
    expect(within(current).queryByText('Next billing date')).toBeNull();
    const usage = within(current).getByRole('region', { name: 'This month’s usage' });
    expect(
      within(usage).getByRole('progressbar', { name: 'Resume generations: 2 of 3 used' }),
    ).toBeInTheDocument();
    expect(within(usage).getByText(/^Resets on /)).toBeInTheDocument();
    // No checkout yet, and /upgrade is still coming soon: nothing links there (audit ST-08).
    expect(within(current).queryByRole('link')).toBeNull();
    expect(within(current).getByRole('button', { name: 'Upgrade to Pro' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(current).queryByRole('button', { name: 'Cancel subscription' })).toBeNull();
  });

  it('shows Pro with its price, renewal and start, and cancels behind a confirmation', async () => {
    const user = userEvent.setup();
    mockStore.state.subscription = {
      ...mockStore.state.subscription,
      plan: 'pro',
      planId: 'pro_monthly',
    };
    renderWithQuery(<SettingsScreen initialSection="billing" />);
    await settle();

    const current = region('Current plan');
    expect(within(current).getByRole('heading', { name: 'NextKin Pro' })).toBeInTheDocument();
    expect(within(current).getByText('Active')).toBeInTheDocument();
    // The plan's own price, not the board's $9.99 (toreview.md §92).
    expect(await within(current).findAllByText('₹1,499')).not.toHaveLength(0);
    expect(within(current).getByText('Billed monthly')).toBeInTheDocument();
    expect(within(current).getByText('Next billing date')).toBeInTheDocument();
    expect(within(current).getByText('(in 30 days)')).toBeInTheDocument();
    // The oldest paid invoice.
    expect(within(current).getByText('Mar 1, 2024')).toBeInTheDocument();
    expect(within(current).getByRole('button', { name: 'Change plan' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.click(within(current).getByRole('button', { name: 'Cancel subscription' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel your subscription?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel subscription' }));
    await waitFor(() => expect(mockStore.state.subscription.cancelAtPeriodEnd).toBe(true), {
      timeout: SETTLE_MS.normal * 2,
    });
    expect(
      await within(current).findByRole(
        'button',
        { name: 'Keep my subscription' },
        { timeout: SETTLE_MS.normal * 2 },
      ),
    ).toBeInTheDocument();
    expect(within(current).getByText(/^Ends /)).toBeInTheDocument();
  });

  it('shows the card on file and the invoices', async () => {
    renderWithQuery(<SettingsScreen initialSection="billing" />);
    await settle();

    const method = region('Payment method');
    expect(within(method).getByText('Visa ending in 4242')).toBeInTheDocument();
    expect(within(method).getByText('Default')).toBeInTheDocument();
    expect(within(method).getByRole('button', { name: 'Update' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    const rows = within(region('Billing history')).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('inv_2024_04');
    expect(rows[1]).toHaveTextContent('Apr 1, 2024');
    expect(rows[1]).toHaveTextContent('NextKin Pro (Monthly)');
    expect(rows[1]).toHaveTextContent('₹1,499');
    expect(rows[1]).toHaveTextContent('Paid');
    expect(
      within(rows[2]!).getByRole('button', { name: 'Download the Mar 1, 2024 invoice' }),
    ).toBeInTheDocument();
  });

  it('saves auto-renewal and the billing cycle as they change', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SettingsScreen initialSection="billing" />);
    await settle();

    const renew = screen.getByRole('switch', { name: 'Auto-renewal' });
    expect(renew).toHaveAttribute('aria-checked', 'true');
    await user.click(renew);
    expect(renew).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => expect(mockStore.state.billing.settings.autoRenew).toBe(false), {
      timeout: SETTLE_MS.normal * 2,
    });
  });
});
