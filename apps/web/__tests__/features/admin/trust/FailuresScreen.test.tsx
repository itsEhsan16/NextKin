import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { FailuresScreen } from '@/features/admin/trust/failures/FailuresScreen';
import { Toaster } from '@/ui/Toaster';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

const wait = { timeout: SETTLE_MS.normal * 4 };

beforeAll(() => {
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: () => {} });
});

describe('FailuresScreen (Figma 406:1195)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the board’s cards and runs', async () => {
    renderWithQuery(<FailuresScreen />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Generation failures' }),
    ).toBeInTheDocument();
    const failed = await screen.findByRole('region', { name: 'Failed (30 days)' }, wait);
    expect(await within(failed).findByText('461', {}, wait)).toBeInTheDocument();
    expect(within(failed).getByText('of 18,904 runs, after retries')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Most common' })).getByText('Timeout'),
    ).toBeInTheDocument();

    const runs = screen.getByRole('region', { name: 'Failed runs' });
    expect(await within(runs).findByText('run ···7b3e', {}, wait)).toBeInTheDocument();
    expect(within(runs).getByText('Page 1 of 52')).toBeInTheDocument();
    expect(within(runs).getByRole('radio', { name: /Open\s*7/ })).toBeInTheDocument();
  });

  it('opens a run in the drawer and retries it', async () => {
    const user = userEvent.setup();
    renderWithQuery(<FailuresScreen />);

    await user.click(await screen.findByRole('button', { name: 'Open run ···c51a' }, wait));
    const drawer = await screen.findByRole('dialog', { name: 'run ···c51a' }, wait);
    expect(
      await within(drawer).findByText('Timed out after 60 s on all 3 attempts', {}, wait),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByText(/request_id\s+req_···93ab\s+stage\s+tailor\.rewrite/),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('3,912 in · 0 out')).toBeInTheDocument();
    expect(within(drawer).getByText('Resume content isn’t shown here.')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: 'Retry run' }));
    await waitFor(() => expect(within(drawer).getByText('Retrying')).toBeInTheDocument(), wait);
  });

  it('narrows to a status and filters by search', async () => {
    const user = userEvent.setup();
    renderWithQuery(<FailuresScreen />);
    const runs = await screen.findByRole('region', { name: 'Failed runs' }, wait);
    await within(runs).findByText('run ···7b3e', {}, wait);

    await user.click(within(runs).getByRole('radio', { name: 'Retrying' }));
    await waitFor(
      () => expect(within(runs).queryByText('run ···7b3e')).not.toBeInTheDocument(),
      wait,
    );
    expect(within(runs).getByText('run ···0e92')).toBeInTheDocument();

    await user.click(within(runs).getByRole('radio', { name: 'All' }));
    await user.type(within(runs).getByRole('searchbox'), 'PARSE_EMPTY');
    await waitFor(
      () => expect(within(runs).queryByText('run ···0e92')).not.toBeInTheDocument(),
      wait,
    );
  });

  it('retries only the ticked runs that are open, and says so', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <>
        <FailuresScreen />
        <Toaster />
      </>,
    );
    const runs = await screen.findByRole('region', { name: 'Failed runs' }, wait);
    await within(runs).findByText('run ···7b3e', {}, wait);

    await user.click(within(runs).getByRole('checkbox', { name: 'Select run ···38ab' }));
    expect(screen.getByRole('button', { name: 'Retry selected' })).toBeDisabled();
    await user.click(within(runs).getByRole('checkbox', { name: 'Select run ···7b3e' }));
    await user.click(screen.getByRole('button', { name: 'Retry selected' }));

    expect(
      await screen.findByText('Retry queued for run ···7b3e. 1 ticked run wasn’t open.', {}, wait),
    ).toBeInTheDocument();
    const row = within(runs).getByText('run ···38ab').closest('tr')!;
    expect(within(row).getByText('Resolved')).toBeInTheDocument();
  }, 15_000);

  it('shows the empty and error states', async () => {
    const { unmount } = renderWithQuery(<FailuresScreen />, 'empty');
    expect(await screen.findByText('No failed runs', {}, wait)).toBeInTheDocument();
    // The cards agree with the empty table.
    const failed = screen.getByRole('region', { name: 'Failed (30 days)' });
    expect(await within(failed).findByText('0', {}, wait)).toBeInTheDocument();
    unmount();

    renderWithQuery(<FailuresScreen />, 'error');
    expect(
      await screen.findByText(
        'Couldn’t load the failed runs',
        {},
        { timeout: SETTLE_MS.error * 3 },
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Couldn’t load/).length).toBeGreaterThan(1);
    expect(screen.queryByText('Not connected yet')).not.toBeInTheDocument();
  });
});
