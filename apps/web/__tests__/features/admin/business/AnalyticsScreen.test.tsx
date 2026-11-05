import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { AnalyticsScreen } from '@/features/admin/business/screens/AnalyticsScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: jest.fn() }),
}));

const wait = { timeout: SETTLE_MS.normal * 3 };

describe('AnalyticsScreen (Figma 407:1430)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the funnel and marks its weakest hand-off', async () => {
    renderWithQuery(<AnalyticsScreen />);

    const funnel = await screen.findByRole('region', { name: 'Activation funnel' }, wait);
    expect(await within(funnel).findByText('3.4%', {}, wait)).toBeInTheDocument();
    expect(
      within(funnel).getByText('of sign-ups started Pro within 30 days (82 of 2,418)'),
    ).toBeInTheDocument();
    for (const handoff of ['87.0%', '66.9%', '68.4%', '8.5%']) {
      expect(within(funnel).getByText(handoff)).toBeInTheDocument();
    }
    expect(within(funnel).getByText('8.5%').closest('span')).toHaveClass('bg-warning-50');
  });

  it('says what a retention cell holds when focused', async () => {
    renderWithQuery(<AnalyticsScreen />);

    const retention = await screen.findByRole(
      'region',
      { name: 'Week-4 retention by cohort' },
      wait,
    );
    expect(await within(retention).findByText('Week 4 average 41%', {}, wait)).toBeInTheDocument();
    const cell = within(retention).getByRole('gridcell', { name: /Sep 7 cohort, week 4: 42%/ });
    act(() => cell.focus());
    expect(within(retention).getByRole('tooltip')).toHaveTextContent(
      'Sep 7 · Week 4 · 42% (245 of 584)',
    );
  });

  it('makes the heatmap one tab stop that the arrow keys move through', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AnalyticsScreen />);

    const grid = await screen.findByRole('grid', {}, wait);
    const cells = within(grid).getAllByRole('gridcell');
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
    act(() => cells[0]!.focus());
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toHaveAccessibleName(/Sep 7 cohort, week 1/);
    expect(cells.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
  });

  it('switches the window', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AnalyticsScreen />);

    const usage = await screen.findByRole('region', { name: 'Generations by kind' }, wait);
    expect(await within(usage).findByText('18,904 total', {}, wait)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '7 days' }));
    expect(await within(usage).findByText('4,411 total', {}, wait)).toBeInTheDocument();
  });

  it('draws the usage, quota and cost cards', async () => {
    renderWithQuery(<AnalyticsScreen />);

    const quota = await screen.findByRole('region', { name: 'Quota consumption' }, wait);
    expect(await within(quota).findByText('14.2% at cap', {}, wait)).toBeInTheDocument();
    const ats = screen.getByRole('region', { name: 'ATS score distribution' });
    expect(within(ats).getByText('mean score · 6,212 checks · median 73')).toBeInTheDocument();
    expect(within(ats).getByText('Below 60 · 15%')).toBeInTheDocument();
    const cost = screen.getByRole('region', { name: 'Provider usage & cost' });
    expect(within(cost).getByText('Total $1,284.20')).toBeInTheDocument();
    expect(within(cost).getByText('$0.085')).toBeInTheDocument();
  });

  it('says an empty window is empty, not unconnected', async () => {
    renderWithQuery(<AnalyticsScreen />, 'empty');
    expect(await screen.findByText('No sign-ups in this window', {}, wait)).toBeInTheDocument();
    expect(screen.getByText('No quota use in this window')).toBeInTheDocument();
    expect(screen.queryByText('Not connected yet')).not.toBeInTheDocument();
  });

  it('offers a retry when the figures fail', async () => {
    renderWithQuery(<AnalyticsScreen />, 'error');
    expect(
      await screen.findByText('Couldn’t load analytics', {}, { timeout: SETTLE_MS.error * 3 }),
    ).toBeInTheDocument();
  });
});
