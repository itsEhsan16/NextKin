import { screen, within } from '@testing-library/react';

import { HomeScreen } from '@/features/home/screens/HomeScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

jest.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('HomeScreen', () => {
  it('renders the board copy', async () => {
    renderWithQuery(<HomeScreen />);

    expect(screen.getByRole('heading', { name: 'Build better. Land faster.' })).toBeInTheDocument();
    expect(
      screen.getByText('Everything you need to build your career, in one place.'),
    ).toBeInTheDocument();

    // Four tiles, as on mobile: Build Resume covers tailoring too (toreview §155).
    for (const label of ['Build Resume', 'Zero Resume', 'Cover Letter', 'ATS Check']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText('Tailor to a Job')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quick Start' })).toBeInTheDocument();
    // Each tile opens its own flow (toreview §125).
    const hrefs: Record<string, string> = {
      'Build Resume': '/create/build',
      'Zero Resume': '/create/zero-resume',
      'Cover Letter': '/create/cover-letter',
      'ATS Check': '/create/ats-check',
    };
    for (const [label, href] of Object.entries(hrefs)) {
      expect(screen.getByRole('link', { name: new RegExp(`^${label}`) })).toHaveAttribute(
        'href',
        href,
      );
    }
    expect(
      screen.getByRole('heading', { name: 'Improve your chances with AI' }),
    ).toBeInTheDocument();
  });

  it('shows the loading state before the mock layer settles', () => {
    renderWithQuery(<HomeScreen />);
    // The greeting only appears once the user query resolves.
    expect(screen.queryByText(/^Hi /)).not.toBeInTheDocument();
  });

  it('fills in from the data layer', async () => {
    renderWithQuery(<HomeScreen />);

    expect(
      await screen.findByText('Hi George,', {}, { timeout: SETTLE_MS.normal }),
    ).toBeInTheDocument();
    // Both cards that depend on live data resolve. Each query has its own simulated latency, so
    // they settle independently of the greeting rather than together.
    // Eleven picks in the carousel, one per character; the two copies that let it loop are
    // hidden from the reader (`toreview.md` §101).
    await screen.findAllByText(/% Match/, {}, { timeout: 4000 });
    const carousel = screen.getByRole('region', { name: 'Top job matches' });
    const cards = within(carousel).getAllByRole('listitem');
    expect(cards).toHaveLength(11);
    expect(cards[0]).toHaveTextContent('Lead UX Designer');
    expect(cards[1]).toHaveTextContent('Sr. UX Designer');
    // Each card opens its job's own page (724:2, `toreview.md` §103).
    expect(within(cards[0]!).getByRole('link')).toHaveAttribute('href', '/jobs/job_google');
    expect(
      await screen.findByRole('img', { name: /ATS Score/ }, { timeout: 4000 }),
    ).toBeInTheDocument();

    // Recent Activity shows 286:729's own three rows, not the shared fixture's most recent
    // three (mobile's copy, tuned to mobile's own board — see RecentActivityCard.tsx).
    expect(
      await screen.findByText('Your resume was ATS scanned', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('You tailored resume for Google')).toBeInTheDocument();
    // Capitalised — 286:729 draws "Yesterday", not the lowercase `Intl.RelativeTimeFormat`
    // gives mid-sentence callers like ResumeProgressCard's "Last updated yesterday".
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Applied to Lead UX Designer at Google')).toBeInTheDocument();
  });

  it('shows an empty state per card when every list comes back empty', async () => {
    renderWithQuery(<HomeScreen />, 'empty');

    expect(
      await screen.findByText('No matches yet', {}, { timeout: SETTLE_MS.empty }),
    ).toBeInTheDocument();
    expect(screen.getByText('No resumes yet')).toBeInTheDocument();
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
  });

  it('shows the page-level error state when the user query fails', async () => {
    renderWithQuery(<HomeScreen />, 'error');

    expect(
      await screen.findByText('Something went wrong', {}, { timeout: SETTLE_MS.error }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
