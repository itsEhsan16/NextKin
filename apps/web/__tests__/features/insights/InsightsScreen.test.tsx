import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { InsightsScreen } from '@/features/insights/screens/InsightsScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const wait = { timeout: SETTLE_MS.normal * 3 };

describe('InsightsScreen (461:14)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the board’s thirty days', async () => {
    renderWithQuery(<InsightsScreen />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your Career Insights' }),
    ).toBeInTheDocument();

    const jobs = await screen.findByRole('region', { name: 'Jobs Analyzed' }, wait);
    expect(within(jobs).getByText('24')).toBeInTheDocument();
    expect(within(jobs).getByText('vs previous 30 days')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Interviews' })).getByText(/200%/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Resume Score' })).getByText(
        'Based on 10+ job matches',
      ),
    ).toBeInTheDocument();

    const funnel = screen.getByRole('region', { name: 'Application Funnel' });
    expect(within(funnel).getByText('Offers')).toBeInTheDocument();
    expect(within(funnel).getByText('8%')).toBeInTheDocument();

    expect(screen.getByText(/You often miss key skills/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Top Skills in Demand' })).getByText('92%'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Target Roles' })).getByText('Product Researcher'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Matched Jobs/ })).toHaveAttribute(
      'href',
      '/jobs',
    );
  });

  it('switches the window', async () => {
    const user = userEvent.setup();
    renderWithQuery(<InsightsScreen />);
    await screen.findByRole('region', { name: 'Jobs Analyzed' }, wait);

    await user.click(screen.getByRole('button', { name: 'Insights window: Last 30 days' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Last 90 days' }));

    const jobs = screen.getByRole('region', { name: 'Jobs Analyzed' });
    expect(await within(jobs).findByText('58', {}, wait)).toBeInTheDocument();
    expect(within(jobs).getByText('vs previous 90 days')).toBeInTheDocument();
  });
});
