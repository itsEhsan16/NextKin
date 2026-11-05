import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { PlansScreen } from '@/features/admin/business/screens/PlansScreen';
import { Toaster } from '@/ui/Toaster';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

function WithToaster({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: jest.fn() }),
}));

const wait = { timeout: SETTLE_MS.normal * 3 };

describe('PlansScreen (Figma 406:2873)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the three plans as the board does', async () => {
    renderWithQuery(
      <WithToaster>
        <PlansScreen />
      </WithToaster>,
    );

    await screen.findByText('47,800', {}, wait);
    const free = screen.getByRole('region', { name: 'Free' });
    expect(within(free).getByText('Default plan')).toBeInTheDocument();
    expect(within(free).getByText('€0 · A$0 · no card needed')).toBeInTheDocument();
    expect(within(free).getByText('1 per resume')).toBeInTheDocument();
    expect(within(free).getByText('Quotas last changed Sep 2 by Ana L.')).toBeInTheDocument();

    const monthly = screen.getByRole('region', { name: 'Pro monthly' });
    expect(within(monthly).getByText('63% of Pro')).toBeInTheDocument();
    expect(within(monthly).getByText('10 per month')).toBeInTheDocument();

    const annual = screen.getByRole('region', { name: 'Pro annual' });
    expect(within(annual).getByText('Save 52%')).toBeInTheDocument();
    expect(
      within(annual).getByText('€109 · A$165 per year · about $9.08 a month'),
    ).toBeInTheDocument();
  });

  it('publishes a new price version and retires the current one', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WithToaster>
        <PlansScreen />
      </WithToaster>,
    );

    const book = await screen.findByRole('region', { name: 'Price book' });
    await within(book).findByText('3 versions', {}, wait);
    await user.click(screen.getByRole('button', { name: 'New price version' }));

    const dialog = await screen.findByRole('dialog', { name: 'New price version · v4' });
    const usd = within(dialog).getAllByRole('textbox', { name: /USD/ })[0]!;
    await user.clear(usd);
    await user.type(usd, '21');
    await user.click(within(dialog).getByRole('button', { name: 'Publish v4' }));

    await within(book).findByText('4 versions', {}, wait);
    const rows = within(book).getAllByRole('row');
    expect(within(rows[1]!).getByText('v4')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('$21.00')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Retired')).toBeInTheDocument();
    expect(await screen.findByText('Price version v4 published', {}, wait)).toBeInTheDocument();
  });

  it('refuses a comma-decimal price instead of reading it a hundred times larger', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WithToaster>
        <PlansScreen />
      </WithToaster>,
    );

    const book = await screen.findByRole('region', { name: 'Price book' });
    await within(book).findByText('3 versions', {}, wait);
    await user.click(screen.getByRole('button', { name: 'New price version' }));
    const dialog = await screen.findByRole('dialog', { name: 'New price version · v4' });
    const eur = within(dialog).getAllByRole('textbox', { name: /EUR/ })[0]!;
    await user.clear(eur);
    await user.type(eur, '19,50');
    expect(within(dialog).getByText('A price like 19.50.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Publish v4' })).toBeDisabled();
  });

  it('makes a quota unlimited', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WithToaster>
        <PlansScreen />
      </WithToaster>,
    );

    await screen.findByText('47,800', {}, wait);
    await user.click(screen.getByRole('button', { name: 'Edit quotas for Free' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit quotas · Free' });
    await user.click(within(dialog).getAllByRole('checkbox', { name: 'Unlimited' })[0]!);
    await user.click(within(dialog).getByRole('button', { name: 'Save quotas' }));

    const free = await screen.findByRole('region', { name: 'Free' }, wait);
    await within(free).findByText('Unlimited', {}, wait);
    expect(within(free).getByText(/Quotas last changed .* by Ehsan/)).toBeInTheDocument();
  });

  it('pages comped access and masks every user', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <WithToaster>
        <PlansScreen />
      </WithToaster>,
    );

    const comps = await screen.findByRole('region', { name: 'Comped access' });
    expect(await within(comps).findByText('Page 1 of 2 · 6 active', {}, wait)).toBeInTheDocument();
    expect(within(comps).getByText('user ···4f2a')).toBeInTheDocument();
    expect(within(comps).queryByText(/usr_/)).not.toBeInTheDocument();
    await user.click(within(comps).getByRole('button', { name: 'Next' }));
    await waitFor(
      () => expect(within(comps).getByText('Page 2 of 2 · 6 active')).toBeInTheDocument(),
      wait,
    );
  });

  it('offers a retry when the plans fail', async () => {
    renderWithQuery(
      <WithToaster>
        <PlansScreen />
      </WithToaster>,
      'error',
    );
    expect(
      await screen.findByText('Couldn’t load the plans', {}, { timeout: SETTLE_MS.error * 3 }),
    ).toBeInTheDocument();
  });
});
