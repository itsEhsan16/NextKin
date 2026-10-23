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

  it('shows the current plan beside Pro, worded to V2 §13', async () => {
    renderWithQuery(<SettingsScreen initialSection="billing" />);
    await settle();

    expect(screen.getByRole('heading', { level: 1, name: 'Billing & plan' })).toBeInTheDocument();
    const current = region('Current plan');
    expect(within(current).getByText('Free plan')).toBeInTheDocument();
    expect(within(current).getByText('3 resume generations a month')).toBeInTheDocument();
    expect(within(current).getByText('DOCX export').closest('li')).toHaveTextContent(
      'not included',
    );
    expect(within(current).getByRole('link', { name: 'View all plans' })).toHaveAttribute(
      'href',
      '/upgrade',
    );

    const pro = region('NextKin Pro');
    // The plan's own price, not the board's $9.99 (toreview.md §92).
    expect(within(pro).getByText('₹1,499')).toBeInTheDocument();
    expect(within(pro).getByText('/ month')).toBeInTheDocument();
    expect(within(pro).getByRole('link', { name: 'Upgrade to Pro' })).toHaveAttribute(
      'href',
      '/upgrade',
    );
  });

  it('lists the card on file and the invoices', async () => {
    renderWithQuery(<SettingsScreen initialSection="billing" />);
    await settle();

    const methods = within(region('Billing information')).getByRole('list', {
      name: 'Payment methods',
    });
    expect(methods).toHaveTextContent('Visa');
    expect(methods).toHaveTextContent('4242');
    expect(within(methods).getByText('Default')).toBeInTheDocument();

    const rows = within(region('Billing history')).getAllByRole('row');
    expect(rows).toHaveLength(3);
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
