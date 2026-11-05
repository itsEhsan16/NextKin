import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { AuditLogScreen } from '@/features/admin/trust/audit/AuditLogScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

const wait = { timeout: SETTLE_MS.normal * 4 };

describe('AuditLogScreen (Figma 408:1531)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the board’s events, masked, with no row actions', async () => {
    renderWithQuery(<AuditLogScreen />);

    const events = await screen.findByRole('region', { name: 'Events' }, wait);
    expect(await within(events).findByText('2,204 in range', {}, wait)).toBeInTheDocument();
    expect(within(events).getByText('Page 1 of 184')).toBeInTheDocument();
    expect(within(events).getByText('Sent a password reset')).toBeInTheDocument();
    expect(within(events).getAllByText('102.89.···.14').length).toBeGreaterThan(0);
    expect(within(events).queryByText('102.89.53.14')).not.toBeInTheDocument();
    expect(within(events).getByText('Audited read')).toBeInTheDocument();
    expect(within(events).queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
  });

  it('filters by target type and clears back', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AuditLogScreen />);
    const events = await screen.findByRole('region', { name: 'Events' }, wait);
    await within(events).findByText('2,204 in range', {}, wait);

    await user.click(screen.getByRole('button', { name: 'Target type: All targets' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Job providers' }));
    await waitFor(() => expect(within(events).getByText('1 in range')).toBeInTheDocument(), wait);
    expect(within(events).getByText('Replaced provider key')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(await within(events).findByText('2,204 in range', {}, wait)).toBeInTheDocument();
  });

  it('searches reasons and IPs', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AuditLogScreen />);
    const events = await screen.findByRole('region', { name: 'Events' }, wait);
    await within(events).findByText('2,204 in range', {}, wait);

    await user.type(screen.getByRole('searchbox', { name: 'Search the audit log' }), 'RPT-1029');
    await waitFor(() => expect(within(events).getByText('1 in range')).toBeInTheDocument(), wait);
    expect(within(events).getByText('Suspended an account')).toBeInTheDocument();
  });
});
