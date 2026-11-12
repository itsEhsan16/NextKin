import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { ApplicationsScreen } from '@/features/applications/screens/ApplicationsScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

/**
 * The eight rows the board draws (286:1312-1521), top to bottom under "Most recent". Each row's
 * select button is named "<title> at <company>, <location>".
 */
const BOARD_ROWS = [
  'Lead UX Designer at Google, Bengaluru, India',
  'Sr. UX Designer at Adobe, Remote',
  'Product Designer at Atlassian, Bengaluru, India',
  'UX Designer at Microsoft, Hyderabad, India',
  'Product Designer at Airbnb, Remote',
  'Senior Product Designer at Spotify, Bengaluru, India',
  'Product Designer at Notion, Remote',
  'UX Designer at Flipkart, Bengaluru, India',
] as const;

/** What each of those rows' status pill reads (286:1337-1543). */
const BOARD_STAGES = [
  'In Review',
  'Interview',
  'Screening',
  'Offer',
  'Rejected',
  'Withdrawn',
  'In Review',
  'Closed',
] as const;

/** Every row's select button, in list order: the only buttons whose name reads "… at …". */
const rowNames = () =>
  screen
    .getAllByRole('button', { name: / at / })
    .map((button) => button.getAttribute('aria-label'));

const row = (name: string) => {
  const container = screen.getByRole('button', { name }).closest('div');
  expect(container).not.toBeNull();
  return within(container as HTMLElement);
};

const settle = () => screen.findByText('24 applications', {}, { timeout: SETTLE_MS.normal });

const panelFor = (name: string) => screen.findByRole('region', { name }, { timeout: 3000 });

describe('ApplicationsScreen', () => {
  // Status updates mutate the shared mock store's singleton, which otherwise leaks across tests.
  beforeEach(() => {
    resetMockRepos();
  });

  it('renders the board copy', () => {
    renderWithQuery(<ApplicationsScreen />);

    expect(screen.getByRole('heading', { name: 'Track your progress' })).toBeInTheDocument();
    expect(
      screen.getByText('Stay organized, follow up, and never miss an opportunity.'),
    ).toBeInTheDocument();
    for (const label of ['Time period', 'Job type', 'Company', 'Location', 'More filters']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort by: Most recent' })).toBeInTheDocument();
  });

  it('shows the loading state before the mock layer settles', () => {
    renderWithQuery(<ApplicationsScreen />);

    expect(screen.queryByText(/applications$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Lead UX Designer')).not.toBeInTheDocument();
    // The pills show their names alone until there is something to count.
    expect(screen.getByRole('tab', { name: 'All', selected: true })).toBeInTheDocument();
  });

  it("lists the board's eight rows first, newest first, with the first one open", async () => {
    renderWithQuery(<ApplicationsScreen />);
    await settle();

    expect(rowNames().slice(0, BOARD_ROWS.length)).toEqual(BOARD_ROWS);
    BOARD_ROWS.forEach((name, index) => {
      expect(row(name).getByText(BOARD_STAGES[index] as string)).toBeInTheDocument();
    });
    expect(row(BOARD_ROWS[0]).getByText('2 days ago')).toBeInTheDocument();
    expect(row(BOARD_ROWS[7]).getByText('4 weeks ago')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BOARD_ROWS[0] })).toHaveAttribute(
      'aria-current',
      'true',
    );

    for (const name of [
      'All (24)',
      'In Review (5)',
      'Interview (3)',
      'Offer (1)',
      'Rejected (4)',
      'Withdrawn (1)',
    ]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }

    // The detail card, defaulted to the first row without a click, as the board draws it.
    const panel = await panelFor('Lead UX Designer at Google');
    expect(
      within(panel).getByRole('heading', { level: 2, name: 'Lead UX Designer' }),
    ).toBeInTheDocument();
    expect(within(panel).getByText(/\(2 days ago\)$/)).toBeInTheDocument();
    expect(within(panel).getByText('GOO-UX-10234')).toBeInTheDocument();
    expect(within(panel).getByText('Bengaluru, India (On-site)')).toBeInTheDocument();
    // The Jobs board's figures, not this board's Hybrid and ₹35–52 LPA (`toreview.md` §87).
    expect(within(panel).getByText('₹48–62 LPA')).toBeInTheDocument();
    // Once, by the logo: the tabs no longer repeat it (redesign R6d, AP-04).
    expect(within(panel).getAllByText('In Review')).toHaveLength(1);
    expect(
      within(panel).getByText(/This team owns end-to-end design for Search and Workspace/),
    ).toBeInTheDocument();

    expect(within(panel).getByRole('link', { name: 'View Job' })).toHaveAttribute(
      'href',
      '/jobs?job=job_google',
    );
    expect(within(panel).getByRole('link', { name: 'View full job description' })).toHaveAttribute(
      'href',
      '/jobs?job=job_google',
    );
    expect(within(panel).getByRole('button', { name: 'Update Status' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /Prepare for your interview/ })).toHaveAttribute(
      'href',
      '/interview',
    );
  });

  it('narrows the list to one status', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ApplicationsScreen />);
    await settle();

    await user.click(screen.getByRole('tab', { name: 'Interview (3)' }));

    expect(screen.getByText('3 applications')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Interview (3)', selected: true })).toBeInTheDocument();
    expect(rowNames()).toEqual([
      'Sr. UX Designer at Adobe, Remote',
      'Product Designer at Linear, Remote (India)',
      'Product Designer, Growth at Postman, Bengaluru',
    ]);
    // The open card follows the list: Google left it, so its first row opens instead.
    expect(await panelFor('Sr. UX Designer at Adobe')).toBeInTheDocument();
  });

  it('filters through a chip and resets', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ApplicationsScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: /^Company/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Google' }));
    // Radix hides the rest of the page from the accessibility tree while its menu is open.
    await user.keyboard('{Escape}');

    expect(await screen.findByText('1 application')).toBeInTheDocument();
    // The pills count what the chips leave.
    expect(screen.getByRole('tab', { name: 'All (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Interview (0)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(await screen.findByText('24 applications')).toBeInTheDocument();
  });

  it('updates the status optimistically', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ApplicationsScreen />);
    await settle();
    const panel = await panelFor('Lead UX Designer at Google');

    await user.click(within(panel).getByRole('button', { name: 'Update Status' }));
    // One status at a time: radio rows (AP-07).
    await user.click(await screen.findByRole('menuitemradio', { name: 'Offer' }));
    await user.keyboard('{Escape}');

    expect(within(panel).getAllByText('Offer')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Offer (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'In Review (4)' })).toBeInTheDocument();
    expect(row(BOARD_ROWS[0]).getByText('Offer')).toBeInTheDocument();
  });

  it('switches detail tabs', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ApplicationsScreen />);
    await settle();
    const panel = await panelFor('Lead UX Designer at Google');

    await user.click(within(panel).getByRole('tab', { name: 'Application' }));
    expect(within(panel).getByText('Resume sent')).toBeInTheDocument();
    expect(
      await within(panel).findByRole(
        'link',
        { name: 'Software Engineer Resume' },
        { timeout: 2000 },
      ),
    ).toHaveAttribute('href', '/resumes?resume=res_swe');

    // The undrawn tabs say they are coming (AP-05).
    await user.click(within(panel).getByRole('tab', { name: 'Follow-ups Soon' }));
    expect(within(panel).getByText('No follow-ups yet')).toBeInTheDocument();

    await user.click(within(panel).getByRole('tab', { name: 'Notes Soon' }));
    expect(within(panel).getByText('No notes yet')).toBeInTheDocument();
  });

  it('re-sorts under the sort control', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ApplicationsScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'Sort by: Most recent' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Oldest first' }));
    await user.keyboard('{Escape}');

    expect(
      await screen.findByRole('button', { name: 'Sort by: Oldest first' }),
    ).toBeInTheDocument();
    // job_1, applied 75 days ago, is the oldest of the 24.
    expect(rowNames()[0]).toBe('Senior Product Designer at Stripe, San Francisco, CA');
  });

  it('shows an empty state when there are no applications at all', async () => {
    renderWithQuery(<ApplicationsScreen />, 'empty');

    expect(
      await screen.findByText('No applications yet', {}, { timeout: SETTLE_MS.empty }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nothing to track yet')).toBeInTheDocument();
  });

  it('says the list failed once, with one retry', async () => {
    renderWithQuery(<ApplicationsScreen />, 'error');

    expect(
      await screen.findByText("Couldn't load your applications", {}, { timeout: SETTLE_MS.error }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('opens the application a link names (?application=, `toreview.md` §102)', async () => {
    renderWithQuery(<ApplicationsScreen initialId="app_web_adobe" />);
    expect(await panelFor('Sr. UX Designer at Adobe')).toBeInTheDocument();
  });
});
