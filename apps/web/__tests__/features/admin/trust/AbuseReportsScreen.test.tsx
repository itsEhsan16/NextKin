import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { AbuseReportsScreen } from '@/features/admin/trust/reports/AbuseReportsScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

const wait = { timeout: SETTLE_MS.normal * 4 };

describe('AbuseReportsScreen (Figma 407:946)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('lists the reports and opens the newest open one', async () => {
    renderWithQuery(<AbuseReportsScreen />);

    const reports = await screen.findByRole('region', { name: 'Reports' }, wait);
    expect(await within(reports).findByText('link ···k3p9', {}, wait)).toBeInTheDocument();
    expect(within(reports).getByText('Page 1 of 2')).toBeInTheDocument();

    const card = await screen.findByRole('region', { name: 'RPT-1042' }, wait);
    expect(await within(card).findByText(/Lumen Labs/, {}, wait)).toBeInTheDocument();
    expect(within(card).getByText('Spam · dismissed Sep 12')).toBeInTheDocument();
    expect(within(card).getByText('user ···4f2a')).toBeInTheDocument();
  });

  it('dismisses a report with a reason code', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AbuseReportsScreen />);

    const card = await screen.findByRole('region', { name: 'RPT-1042' }, wait);
    await user.click(await within(card).findByRole('button', { name: 'Dismiss' }, wait));
    const dialog = await screen.findByRole('dialog', { name: 'Dismiss this report?' }, wait);
    const confirm = within(dialog).getByRole('button', { name: 'Dismiss report' });
    expect(confirm).toBeDisabled();

    await user.click(within(dialog).getByRole('radio', { name: /Not a violation/ }));
    await user.click(confirm);
    await waitFor(
      () =>
        expect(
          screen.queryByRole('dialog', { name: 'Dismiss this report?' }),
        ).not.toBeInTheDocument(),
      wait,
    );
    const settled = await screen.findByRole('region', { name: 'RPT-1042' }, wait);
    expect(await within(settled).findByText(/Settled: dismissed/, {}, wait)).toBeInTheDocument();
    // The reason reads as the dialog named it, and the cards count the decision.
    expect(within(settled).getByText(/Not a violation/)).toBeInTheDocument();
    const resolved = screen.getByRole('region', { name: 'Resolved, 30 days' });
    expect(await within(resolved).findByText('15', {}, wait)).toBeInTheDocument();
  });

  it('settles the report a row’s menu names, even after another was opened', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AbuseReportsScreen />);
    await screen.findByRole('region', { name: 'RPT-1042' }, wait);

    await user.click(screen.getByRole('button', { name: 'Actions for RPT-1042' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dismiss' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Actions for RPT-1041' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Disable public link' }));

    const dialog = await screen.findByRole('dialog', { name: 'Disable the public link?' }, wait);
    expect(within(dialog).getByText(/link ···a7f2 stops opening/)).toBeInTheDocument();
  });

  it('says so when there are no reports', async () => {
    renderWithQuery(<AbuseReportsScreen />, 'empty');
    expect(await screen.findByText('No reports', {}, wait)).toBeInTheDocument();
    const median = screen.getByRole('region', { name: 'Median time to resolve' });
    expect(await within(median).findByText('—', {}, wait)).toBeInTheDocument();
  });

  it('says the counts failed to load, not that they aren’t connected', async () => {
    renderWithQuery(<AbuseReportsScreen />, 'error');
    const open = await screen.findByRole('region', { name: 'Open' }, wait);
    expect(
      await within(open).findByText(/Couldn’t load/, {}, { timeout: SETTLE_MS.error * 3 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Not connected yet')).not.toBeInTheDocument();
  });
});
