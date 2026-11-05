import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { KbReviewScreen } from '@/features/admin/content/screens/KbReviewScreen';
import { TechnologiesScreen } from '@/features/admin/content/screens/TechnologiesScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: jest.fn() }),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };

describe('Technology KB (Figma 409:1872)', () => {
  beforeEach(() => resetMockRepos());

  it('lists the board’s first page with its sources and statuses', async () => {
    renderWithQuery(<TechnologiesScreen />);
    const table = await screen.findByRole('table', {}, wait);
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText('Showing 10 of 1,284')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 129')).toBeInTheDocument();
    expect(within(table).getAllByText('Needs source')).toHaveLength(1);
    expect(within(table).getByText('Reported')).toBeInTheDocument();
  });

  it('imports the valid rows and lists the rest', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TechnologiesScreen />);
    await screen.findByRole('table', {}, wait);

    await user.click(screen.getByRole('button', { name: 'Import CSV / JSON' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import technologies' });
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Or paste the rows' }),
      'name,category,release_date,source{enter}Hono,Web framework,,{enter},Runtime,,',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));

    expect(
      await within(dialog).findByText('1 row sent to the review queue', {}, wait),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Row 2')).toBeInTheDocument();
    expect(within(dialog).getByText('missing a name')).toBeInTheDocument();
  });

  it('names a missing field when Add is pressed, and wants a web address as the source', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TechnologiesScreen />);
    await screen.findByRole('table', {}, wait);

    await user.click(screen.getByRole('button', { name: 'Add technology' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add technology' });
    await user.click(within(dialog).getByRole('button', { name: 'Add to review queue' }));
    expect(within(dialog).getByText('Give it a name.')).toBeInTheDocument();
    expect(within(dialog).getByText('Give it a category.')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: /Release date/ }), '2024-04-01');
    await user.type(within(dialog).getByRole('textbox', { name: /Cited source/ }), 'see the blog');
    expect(within(dialog).getByText('Use a web address starting https://.')).toBeInTheDocument();
  });

  it('counts each tab by what it lists', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TechnologiesScreen />);
    await screen.findByRole('table', {}, wait);
    await user.click(screen.getByRole('tab', { name: /Review queue/ }));
    expect(await screen.findByText('Showing 10 of 14', {}, wait)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Imports/ }));
    expect(await screen.findByText('Showing 3 of 3', {}, wait)).toBeInTheDocument();
  });
});

describe('KB review queue (Figma 410:1771)', () => {
  beforeEach(() => resetMockRepos());

  it('shows the first change in full and approves it', async () => {
    const user = userEvent.setup();
    renderWithQuery(<KbReviewScreen />);

    expect(
      await screen.findByText('Next.js — release date and latest version', {}, wait),
    ).toBeInTheDocument();
    expect(
      screen.getByText('14 changes waiting · approve, edit or reject each one'),
    ).toBeInTheDocument();
    expect(screen.getByText('Disputed: release date')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Imports/ })).toHaveTextContent('9');

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(
      () =>
        expect(
          screen.getByText('13 changes waiting · approve, edit or reject each one'),
        ).toBeInTheDocument(),
      wait,
    );
    expect(screen.queryByText('Next.js · release date')).not.toBeInTheDocument();
  });

  it('won’t approve a date change with no cited source', async () => {
    const user = userEvent.setup();
    renderWithQuery(<KbReviewScreen />);
    await screen.findByText('Next.js — release date and latest version', {}, wait);

    await user.click(screen.getByRole('button', { name: /Show 6 more/ }));
    await user.click(screen.getByRole('button', { name: /Go · release date/ }));
    expect(await screen.findByText(/has no cited source yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();

    // The Edit dialog takes the source the alert asks for.
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: /Edit Go/ });
    expect(within(dialog).getByRole('textbox', { name: /Release date/ })).toHaveValue('2025-02-11');
    await user.type(
      within(dialog).getByRole('textbox', { name: /Cited source/ }),
      'https://go.dev/doc/devel/release',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText(/cites go\.dev, so it can be approved/, {}, wait),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('opens on the technology a KB row sent it to, and keeps the selection in view', async () => {
    window.history.pushState({}, '', '/admin/technologies/review?tech=Kafka');
    const user = userEvent.setup();
    renderWithQuery(<KbReviewScreen />);
    expect(await screen.findByText('Kafka — latest version', {}, wait)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kafka · latest version/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    window.history.pushState({}, '', '/');
    await user.click(screen.getByRole('button', { name: 'Previous change' }));
    expect(screen.getByRole('button', { name: /Redis · category/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});
