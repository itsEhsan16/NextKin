import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { UserDetailScreen } from '@/features/admin/people/screens/UserDetailScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: jest.fn() }),
}));

const wait = { timeout: SETTLE_MS.normal * 3 };
const AARAV = 'usr_7f3c2b1da91e';

describe('UserDetailScreen (Figma 406:2360)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the board’s account, usage, resumes and actions', async () => {
    renderWithQuery(<UserDetailScreen id={AARAV} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aarav Mehta' }, wait),
    ).toBeInTheDocument();
    expect(screen.getByText(/user ID 7f3c…a91e · joined Mar 14, 2026/)).toBeInTheDocument();
    const usage = screen.getByRole('region', { name: 'Usage this month' });
    expect(within(usage).getByText('38 of 100')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Resumes' })).getAllByRole('button', {
        name: 'View content',
      }),
    ).toHaveLength(3);
    expect(
      within(screen.getByRole('region', { name: 'Recent admin actions' })).getByText(
        'Priya R. · ticket SUP-2104 · Aug 30',
      ),
    ).toBeInTheDocument();
  });

  it('opens a resume only with a reason of ten characters, and records the read', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserDetailScreen id={AARAV} />);
    const resumes = await screen.findByRole('region', { name: 'Resumes' }, wait);

    await user.click(within(resumes).getAllByRole('button', { name: 'View content' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Open resume content?' });
    const open = within(dialog).getByRole('button', { name: 'Open read-only' });
    await user.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'too short');
    expect(open).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: /Reason/ }), ' to tell');
    await user.type(within(dialog).getByRole('textbox', { name: 'Case reference' }), 'SUP-2231');
    await user.click(open);

    const viewer = await screen.findByRole('dialog', { name: 'Resume · updated Nov 2' }, wait);
    expect(within(viewer).getByText('Experience')).toBeInTheDocument();
    await user.click(within(viewer).getByRole('button', { name: 'Close' }));

    const actions = screen.getByRole('region', { name: 'Recent admin actions' });
    await waitFor(
      () => expect(within(actions).getByText(/ticket SUP-2231/)).toBeInTheDocument(),
      wait,
    );
  });

  it('switches sections with its tabs', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserDetailScreen id={AARAV} />);
    await screen.findByRole('heading', { level: 1 }, wait);

    await user.click(screen.getByRole('tab', { name: /Security events/ }));
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Security events' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: /Security events/ })).toBeInTheDocument();

    // The Billing tab shows Plan & access once, not again in the side column.
    await user.click(screen.getByRole('tab', { name: 'Billing' }));
    expect(screen.getAllByRole('region', { name: 'Plan & access' })).toHaveLength(1);
  });

  it('keeps a suspension through a comp', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserDetailScreen id={AARAV} />);
    await user.click(await screen.findByRole('button', { name: 'Suspend' }, wait));
    const dialog = await screen.findByRole('dialog', { name: 'Suspend Aarav Mehta?' });
    await user.click(within(dialog).getByRole('radio', { name: /Abuse/ }));
    await user.type(within(dialog).getByRole('textbox', { name: /Internal note/ }), 'Spam runs');
    await user.click(within(dialog).getByRole('button', { name: 'Suspend account' }));
    expect(await screen.findByRole('button', { name: 'Reactivate' }, wait)).toBeInTheDocument();
    expect(await screen.findByText(/Abuse: Spam runs/, {}, wait)).toBeInTheDocument();
  });

  it('says so when the user can’t be loaded', async () => {
    renderWithQuery(<UserDetailScreen id="usr_missing" />);
    expect(await screen.findByText('Couldn’t load this user', {}, wait)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Users' })).toBeInTheDocument();
  });
});
