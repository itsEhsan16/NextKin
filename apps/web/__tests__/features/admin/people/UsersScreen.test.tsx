import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { UsersScreen } from '@/features/admin/people/screens/UsersScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

const push = jest.fn();
// These flows type into fields and wait out the mock's latency between steps; under a full
// parallel run they need more than Jest's default 5s.
jest.setTimeout(30_000);

jest.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ push }) }));

const wait = { timeout: SETTLE_MS.normal * 3 };

const names = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1]!.textContent);

describe('UsersScreen (Figma 404:614)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the board’s totals and its rows in order', async () => {
    renderWithQuery(<UsersScreen />);

    expect(await screen.findByText('48,212', { selector: 'p' }, wait)).toBeInTheDocument();
    const suspended = screen.getByRole('region', { name: 'Suspended' });
    expect(within(suspended).getByText('abuse 21 · fraud 9 · other 7')).toBeInTheDocument();

    const table = await screen.findByRole('table', {}, wait);
    expect(names(table)[0]).toMatch(/Aarav Mehta/);
    expect(names(table)[7]).toMatch(/Priya Nair/);
    expect(within(table).getByText('38 of 100 generations')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Suspended 37/ })).toBeInTheDocument();
  });

  it('searches, filters by tab and sorts by sign-up date', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UsersScreen />);
    const table = await screen.findByRole('table', {}, wait);

    await user.click(screen.getByRole('radio', { name: 'Pro' }));
    await waitFor(() => expect(names(screen.getByRole('table'))).toHaveLength(3), wait);

    await user.click(screen.getByRole('radio', { name: 'All' }));
    await user.type(screen.getByRole('searchbox', { name: 'Email, name or user ID' }), 'proton');
    await waitFor(
      () => expect(names(screen.getByRole('table'))).toEqual([expect.stringMatching(/Liam/)]),
      wait,
    );

    await user.clear(screen.getByRole('searchbox'));
    await user.click(within(table).getByRole('button', { name: /Sort by Signed up/ }));
    await waitFor(() => expect(names(screen.getByRole('table'))[0]).toMatch(/Carlos Ruiz/), wait);
  });

  it('suspends a user from the row menu, with a reason and a note', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UsersScreen />);
    await screen.findByRole('table', {}, wait);

    await user.click(screen.getByRole('button', { name: 'More for Sofia Rossi' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Suspend' }));

    const dialog = await screen.findByRole('dialog', { name: 'Suspend Sofia Rossi?' });
    const confirm = within(dialog).getByRole('button', { name: 'Suspend account' });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole('radio', { name: /Fraud/ }));
    await user.type(
      within(dialog).getByRole('textbox', { name: /Internal note/ }),
      'Radar flagged three cards',
    );
    await user.click(confirm);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), wait);
    const row = screen.getByRole('row', { name: /Sofia Rossi/ });
    await waitFor(() => expect(within(row).getByText('Suspended')).toBeInTheDocument(), wait);
  });

  it('starts the selection again on a new search, so export names what it exports', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UsersScreen />);
    await screen.findByRole('table', {}, wait);
    await user.click(screen.getByRole('checkbox', { name: 'Select Sofia Rossi' }));
    expect(screen.getByRole('button', { name: /Export 1 selected/ })).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Email, name or user ID' }), 'liam');
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeInTheDocument();
  });

  it('shows the empty and error states', async () => {
    const { unmount } = renderWithQuery(<UsersScreen />, 'empty');
    expect(await screen.findByText('No users yet', {}, wait)).toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          within(screen.getByRole('region', { name: 'Total users' })).getByText('0'),
        ).toBeInTheDocument(),
      wait,
    );
    expect(screen.queryByText('48,212')).not.toBeInTheDocument();
    unmount();

    renderWithQuery(<UsersScreen />, 'error');
    expect(
      await screen.findByText('Couldn’t load users', {}, { timeout: SETTLE_MS.error * 3 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Not connected yet')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again loading the figures' }),
    ).toBeInTheDocument();
  });
});
