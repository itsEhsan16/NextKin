import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { DeletionRequestsScreen } from '@/features/admin/people/screens/DeletionRequestsScreen';
import { StaffScreen } from '@/features/admin/people/screens/StaffScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

// These flows type into fields and wait out the mock's latency between steps; under a full
// parallel run they need more than Jest's default 5s.
jest.setTimeout(30_000);

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: jest.fn() }),
}));

const wait = { timeout: SETTLE_MS.normal * 3 };

describe('StaffScreen (Figma 408:2050)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('counts each role and draws the permission matrix', async () => {
    renderWithQuery(<StaffScreen />);

    const staff = await screen.findByRole('region', { name: 'Staff' }, wait);
    expect(await within(staff).findByText('Amara N.', {}, wait)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Support' })).getByText('4'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'MFA enrolled' })).getByText('10 of 10'),
    ).toBeInTheDocument();

    const matrix = screen.getByRole('region', { name: 'Roles & permissions' });
    const keys = within(matrix)
      .getByRole('rowheader', { name: /providers.keys/ })
      .closest('tr')!;
    expect(within(keys).getAllByText('Allowed')).toHaveLength(1);
  });

  it('changes a role, and filters by it', async () => {
    const user = userEvent.setup();
    renderWithQuery(<StaffScreen />);
    await screen.findByText('Lena S.', {}, wait);

    await user.click(screen.getByRole('button', { name: 'More for Lena S.' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Change role…' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Change Lena S.’s role'.replace('’', "'"),
    });
    await user.click(within(dialog).getByRole('radio', { name: /^Admin/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Change role' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), wait);

    await user.click(screen.getByRole('radio', { name: 'Admin' }));
    await waitFor(() => expect(screen.getByText('Lena S.')).toBeInTheDocument(), wait);
    expect(screen.queryByText('Marco K.')).not.toBeInTheDocument();
  });

  it('invites someone who has never signed in, and names the MFA share without an arrow', async () => {
    const user = userEvent.setup();
    renderWithQuery(<StaffScreen />);
    await user.click(await screen.findByRole('button', { name: 'Invite staff' }, wait));
    const dialog = await screen.findByRole('dialog', { name: 'Invite staff' });
    await user.type(within(dialog).getByRole('textbox', { name: /Name/ }), 'Nina P.');
    await user.type(within(dialog).getByRole('textbox', { name: /Work email/ }), 'nina@nextkin.ai');
    await user.click(within(dialog).getByRole('radio', { name: /^Support/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }));

    // The temporary password is shown once (toreview §171.13), then the dialog closes.
    const sent = await screen.findByRole(
      'dialog',
      { name: 'Invite sent' },
      { timeout: SETTLE_MS.normal * 6 },
    );
    expect(within(sent).getByRole('button', { name: 'Copy password' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    // The invite, then the list's refetch: two mock round trips.
    const row = await screen.findByRole(
      'row',
      { name: /Nina P\./ },
      { timeout: SETTLE_MS.normal * 6 },
    );
    expect(within(row).getByText('Never')).toBeInTheDocument();
    const mfa = screen.getByRole('region', { name: 'MFA enrolled' });
    await waitFor(() => expect(within(mfa).getByText('91% enrolled')).toBeInTheDocument(), wait);
    expect(within(mfa).queryByText(/Down/)).not.toBeInTheDocument();
  });
});

describe('DeletionRequestsScreen (Figma 408:2745)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the board’s cards and its first page', async () => {
    renderWithQuery(<DeletionRequestsScreen />);

    expect(await screen.findByText('user ···4f2a', {}, wait)).toBeInTheDocument();
    // The cards and the list load on their own; wait for the cards too.
    expect(
      await within(screen.getByRole('region', { name: 'Average time to purge' })).findByText(
        '6.2 days',
        {},
        wait,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Due in 7 days' })).getByText('1'),
    ).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
    expect(screen.getByText('3 days')).toBeInTheDocument();
  });

  it('processes a waiting request with a reason', async () => {
    const user = userEvent.setup();
    renderWithQuery(<DeletionRequestsScreen />);
    await screen.findByText('user ···91c7', {}, wait);

    // Process now waits for the staff member's permissions (users.manage).
    await user.click(
      await screen.findByRole('button', { name: 'Process now for user ···91c7' }, wait),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Purge this account now?' });
    await user.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Legal hold lifted');
    await user.click(within(dialog).getByRole('button', { name: 'Process now' }));

    await waitFor(
      () =>
        expect(
          within(screen.getByRole('row', { name: /user ···91c7/ })).getByText('Purging'),
        ).toBeInTheDocument(),
      wait,
    );
  });

  it('filters to the open requests', async () => {
    const user = userEvent.setup();
    renderWithQuery(<DeletionRequestsScreen />);
    await screen.findByText('user ···4f2a', {}, wait);
    await user.click(screen.getByRole('radio', { name: /Open/ }));
    expect(screen.queryByText('user ···7d20')).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('matches only the visible tail of a masked id', async () => {
    const user = userEvent.setup();
    renderWithQuery(<DeletionRequestsScreen />);
    await screen.findByText('user ···4f2a', {}, wait);
    await user.type(screen.getByRole('searchbox'), 'usr');
    expect(await screen.findByText('No requests match', {}, wait)).toBeInTheDocument();
  });

  it('counts nothing beside an empty queue, and says a failed load failed', async () => {
    const { unmount } = renderWithQuery(<DeletionRequestsScreen />, 'empty');
    expect(await screen.findByText('No deletion requests', {}, wait)).toBeInTheDocument();
    const open = screen.getByRole('region', { name: 'Open' });
    await waitFor(() => expect(within(open).getByText('0')).toBeInTheDocument(), wait);
    expect(screen.queryByText(/past the limit/)).not.toBeInTheDocument();
    unmount();

    renderWithQuery(<DeletionRequestsScreen />, 'error');
    expect(
      await screen.findByText(
        'Couldn’t load deletion requests',
        {},
        { timeout: SETTLE_MS.error * 3 },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Not connected yet')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Couldn’t load/).length).toBeGreaterThan(1);
  });
});
