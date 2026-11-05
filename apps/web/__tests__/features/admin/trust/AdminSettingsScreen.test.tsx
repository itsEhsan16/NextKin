import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { AdminSettingsScreen } from '@/features/admin/trust/settings/AdminSettingsScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

const wait = { timeout: SETTLE_MS.normal * 4 };

describe('AdminSettingsScreen (Figma 409:1500)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the Security tab as the board does', async () => {
    renderWithQuery(<AdminSettingsScreen />);

    const mfa = await screen.findByRole('region', { name: 'Multi-factor authentication' }, wait);
    expect(within(mfa).getByRole('switch', { name: 'Require MFA for all staff' })).toBeDisabled();
    expect(within(mfa).getByText(/8 of 10 unused/)).toBeInTheDocument();
    const networks = screen.getByRole('region', { name: 'Allowed networks' });
    expect(within(networks).getByText('41.216.0.0/16')).toBeInTheDocument();
    expect(within(networks).getByText(/41\.216\.···\.7 is on the list/)).toBeInTheDocument();
    expect(
      await within(screen.getByRole('region', { name: 'Your account' })).findByText(
        'Super Admin',
        {},
        wait,
      ),
    ).toBeInTheDocument();
  });

  it('refuses a malformed network and adds a good one', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AdminSettingsScreen />);
    const networks = await screen.findByRole('region', { name: 'Allowed networks' }, wait);

    const field = within(networks).getByRole('textbox', {
      name: 'Add an IP address or CIDR range',
    });
    await user.type(field, '300.1.1.1');
    await user.click(within(networks).getByRole('button', { name: 'Add' }));
    expect(within(networks).getByRole('alert')).toHaveTextContent('IPv4 address or a CIDR range');
    expect(field).toHaveAttribute('aria-invalid', 'true');

    await user.clear(field);
    await user.type(field, '203.0.113.0/24');
    await user.click(within(networks).getByRole('button', { name: 'Add' }));
    expect(await within(networks).findByText('203.0.113.0/24', {}, wait)).toBeInTheDocument();
  });

  it('won’t remove the only entry that covers the current address', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AdminSettingsScreen />);
    const networks = await screen.findByRole('region', { name: 'Allowed networks' }, wait);

    await user.click(within(networks).getByRole('button', { name: 'Remove 41.216.0.0/16' }));
    expect(within(networks).getByRole('alert')).toHaveTextContent('would lock you out');
    expect(within(networks).getByText('41.216.0.0/16')).toBeInTheDocument();
    // A refusal about the list, not the field: the untouched input isn't marked invalid.
    expect(
      within(networks).getByRole('textbox', { name: 'Add an IP address or CIDR range' }),
    ).not.toHaveAttribute('aria-invalid');
  });

  it('regenerates backup codes and shows them once', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AdminSettingsScreen />);
    const mfa = await screen.findByRole('region', { name: 'Multi-factor authentication' }, wait);

    await user.click(within(mfa).getByRole('button', { name: 'Regenerate backup codes' }));
    const confirm = await screen.findByRole('dialog', { name: 'Regenerate backup codes?' });
    await user.click(within(confirm).getByRole('button', { name: 'Regenerate codes' }));
    const codes = await screen.findByRole('dialog', { name: 'Your new backup codes' }, wait);
    expect(within(codes).getAllByRole('listitem')).toHaveLength(10);
    await waitFor(() => expect(within(mfa).getByText(/10 of 10 unused/)).toBeInTheDocument(), wait);
  });
});
