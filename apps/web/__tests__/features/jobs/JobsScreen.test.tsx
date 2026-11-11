import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useMockModeStore } from '@nextkin/shared/mock';
import { resetMockRepos } from '@nextkin/shared/repos';

import { JobsScreen } from '@/features/jobs/screens/JobsScreen';
import { recordValues } from '../../../testSupport/recordValues';
import { ApplyAskHost } from '@/features/applications/components/ApplyAskHost';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

/**
 * The five cards the board draws (304:2451-2637), top to bottom. Each card's select button is
 * named "<title> at <company>, <location>".
 */
const BOARD_CARDS = [
  'Lead UX Designer at Google, Bengaluru, India',
  'Sr. UX Designer at Adobe, Remote',
  'Product Designer at Atlassian, Bengaluru, India',
  'UX Designer at Microsoft, Hyderabad, India',
  'Product Designer at Airbnb, Remote',
] as const;

/** Every card's select button, in list order — the only buttons whose name reads "… at …". */
const cardNames = () =>
  screen
    .getAllByRole('button', { name: / at / })
    .map((button) => button.getAttribute('aria-label'));

/**
 * The detail panel for the default job. List and detail are separate queries, each with its own
 * simulated latency, so this waits past both rather than the default `findBy` second.
 */
/** Lets the mock layer's calls land for a while, inside `act`, since they update the screen. */
const settle = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

const openPanel = () =>
  screen.findByRole('region', { name: 'Lead UX Designer at Google' }, { timeout: 3000 });

describe('JobsScreen', () => {
  // Save-toggle and apply tests mutate the shared mock store's singleton, which otherwise leaks
  // across tests in this file (HomeScreen's suite never mutates data, so it never needed this).
  beforeEach(() => {
    resetMockRepos();
  });

  it('draws the redrawn card: verdict, facts, why it matches and the footer (719:2)', async () => {
    renderWithQuery(<JobsScreen />);
    const select = await screen.findByRole('button', { name: BOARD_CARDS[1] }, { timeout: 3000 });
    const adobe = within(select.parentElement as HTMLElement);

    expect(screen.getAllByText('Strong match').length).toBeGreaterThanOrEqual(5);
    expect(
      screen.getByText('Matches your design systems work and remote preference'),
    ).toBeInTheDocument();
    // Adobe's location is "Remote", so its workplace pill isn't repeated.
    expect(adobe.getAllByText('Remote', { selector: 'li' })).toHaveLength(1);
    expect(screen.getByText('₹15–19 LPA · est.')).toBeInTheDocument();
    expect(screen.getByText('Posted 1 day ago')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Tailor your resume for Sr. UX Designer at Adobe with AI' }),
    ).toHaveAttribute('href', '/jobs/job_adobe/tailor');
  });

  it('renders the board copy', async () => {
    renderWithQuery(<JobsScreen />);

    expect(
      screen.getByRole('heading', { name: 'Find the right opportunities' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Discover jobs that match your skills and career goals.'),
    ).toBeInTheDocument();
    // The source text layer reads "Opportuniies" — the spelling is fixed here; the curly quotes
    // and the line break are the board's.
    expect(screen.getByText('“Better Opportunities Ahead”')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Job title, company, or keyword')).toBeInTheDocument();
    for (const label of [
      'Location',
      'Job type',
      'Experience',
      'Salary',
      'Company',
      'More filters',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
    // The web board's name for the default sort; mobile's board calls the same sort "Relevance".
    expect(screen.getByRole('button', { name: 'Most relevant' })).toBeInTheDocument();
  });

  it('shows the loading state before the mock layer settles', () => {
    renderWithQuery(<JobsScreen />);
    expect(screen.queryByText(/results$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Lead UX Designer')).not.toBeInTheDocument();
  });

  it("lists the board's five jobs first, with the first one open", async () => {
    renderWithQuery(<JobsScreen />);

    // The count is its own mock call, and every call waits a seeded 300–900ms drawn in call
    // order, so one second can leave ~100ms to render. The count's waits give it twice that.
    expect(
      await screen.findByText('39 results', {}, { timeout: SETTLE_MS.normal * 2 }),
    ).toBeInTheDocument();
    await screen.findByRole('button', { name: BOARD_CARDS[0] });
    expect(cardNames().slice(0, BOARD_CARDS.length)).toEqual(BOARD_CARDS);
    expect(screen.getByRole('button', { name: BOARD_CARDS[0] })).toHaveAttribute(
      'aria-current',
      'true',
    );

    // The detail panel fills in with the same job, defaulted without a click, in the board's copy.
    const panel = await openPanel();
    expect(
      within(panel).getByRole('heading', { level: 2, name: 'Lead UX Designer' }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(/This team owns end-to-end design for Search and Workspace/),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Bengaluru, India')).toBeInTheDocument();
    expect(within(panel).getByText('3–5 years')).toBeInTheDocument();
    // Google is one the Applications board shows applied to (In Review), and web's data is one
    // set, so once applications load its card opens on the way to that application rather than
    // "Apply Now" (`toreview.md` §102).
    const applied = await within(panel).findByRole(
      'link',
      { name: 'View application' },
      { timeout: 2000 },
    );
    expect(applied).toHaveAttribute('href', '/applications?application=app_web_google');
    // The redrawn board (304:2680) puts the apply action and View job details straight under the meta
    // line, above the tabs and the description, so they are in the card's first screenful.
    const tabs = within(panel).getByRole('tablist');
    for (const action of [applied, within(panel).getByRole('link', { name: 'View job details' })]) {
      expect(action.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // Four tags, then the overflow pill for the other two.
    expect(within(panel).getByText('User Research')).toBeInTheDocument();
    expect(within(panel).getByText('+2')).toBeInTheDocument();
    expect(
      within(panel).getByRole('tab', { name: 'Overview', selected: true }),
    ).toBeInTheDocument();
  });

  it('shows an empty state per section when the catalogue comes back empty', async () => {
    renderWithQuery(<JobsScreen />, 'empty');

    expect(
      await screen.findByText('No jobs match your filters', {}, { timeout: SETTLE_MS.empty }),
    ).toBeInTheDocument();
    expect(screen.getByText('Select a job')).toBeInTheDocument();
  });

  it('shows the page-level error state when the user query fails', async () => {
    renderWithQuery(<JobsScreen />, 'error');

    expect(
      await screen.findByText('Something went wrong', {}, { timeout: SETTLE_MS.error }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('narrows the list through a real filter change', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobsScreen />);

    await screen.findByText('39 results', {}, { timeout: SETTLE_MS.normal * 2 });

    await user.click(screen.getByRole('button', { name: /^Location/ }));
    // Chennai is job_zoho's only listing — a real, data-derived option, not a mocked one.
    const option = await screen.findByRole('menuitemcheckbox', { name: 'Chennai' });
    await user.click(option);
    // A checkbox item's `onSelect` is intentionally prevented (multi-select shouldn't close on
    // every click) — Radix marks the rest of the page `aria-hidden` while its menu stays open, so
    // the page content is unqueryable by role until the dropdown itself is dismissed.
    await user.keyboard('{Escape}');

    // The count and the list are separate calls, and the list keeps its last results on screen
    // until the new ones land, so the count can read "1 result" over the old list for a moment.
    // Wait for the list itself (`toreview.md` §80.3 recorded this as a flaky failure).
    expect(await screen.findByText('1 result')).toBeInTheDocument();
    expect(
      await screen.findByRole(
        'button',
        { name: 'Product Designer at Zoho, Chennai' },
        { timeout: SETTLE_MS.normal * 2 },
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: BOARD_CARDS[0] })).not.toBeInTheDocument(),
    );
  });

  it('opens a picked job at once from the copy the list already holds', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobsScreen />);
    await openPanel();

    await user.click(screen.getByRole('button', { name: BOARD_CARDS[1] }));
    // No wait: the detail is seeded from the list, so there is no skeleton in between.
    expect(screen.getByRole('region', { name: 'Sr. UX Designer at Adobe' })).toBeInTheDocument();
  });

  it('never says "Select a job" while the first load is under way', async () => {
    const seen = recordValues(() => screen.queryByText('Select a job') !== null);
    renderWithQuery(<JobsScreen />);
    await openPanel();

    expect(seen.stop()).toEqual([false]);
  });

  it('keeps the list in place when a background refresh fails', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobsScreen />);
    // The panel opens on the list's copy at once; give the job's own fetch time to land too.
    await openPanel();
    await settle(SETTLE_MS.normal);
    const card = screen.getByRole('button', { name: BOARD_CARDS[0] }).closest('div');

    // Saving refreshes every jobs query when it settles; offline, the save and that refresh both
    // fail. The list already on screen has to survive it.
    useMockModeStore.setState({ mode: 'error' });
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Save job' }));
    await settle(SETTLE_MS.error);

    expect(screen.getByRole('button', { name: BOARD_CARDS[0] })).toBeInTheDocument();
    expect(screen.queryByText(/^Couldn't load/)).not.toBeInTheDocument();
  }, 10_000);

  it('toggles a card save state optimistically', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobsScreen />);

    // The count and list are independent queries with their own simulated latency, so waiting on
    // the count text alone doesn't guarantee the list itself has rendered yet.
    const card = (await screen.findByRole('button', { name: BOARD_CARDS[0] })).closest('div');
    expect(card).not.toBeNull();
    // job_google seeds unsaved.
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Save job' }));

    expect(
      within(card as HTMLElement).getByRole('button', { name: 'Unsave job' }),
    ).toBeInTheDocument();
  });

  it('loads more results via pagination', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobsScreen />);

    // Count and list are independent queries with their own simulated latency — wait for the list
    // itself, not just the count, before looking for its own "Load more" button.
    await screen.findByRole('button', { name: BOARD_CARDS[0] });
    expect(screen.queryByText('Afterpay')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    // job_11 (seed 23, page two) is the only Afterpay listing.
    expect(await screen.findByText('Afterpay', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('leaves page two to "Load more" while the filters read the whole catalogue', async () => {
    renderWithQuery(<JobsScreen />);
    await screen.findByRole('button', { name: BOARD_CARDS[0] });

    // The Location and Company options come from every page. Reading them used to share the
    // visible list's cache entry, so page two appeared in the list by itself (`toreview.md` §84).
    await settle(SETTLE_MS.normal * 2);
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
    expect(screen.queryByText('Afterpay')).not.toBeInTheDocument();
  });

  it('opens the employer’s page, asks, and reflects the Applied state on a yes', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <>
        <JobsScreen />
        <ApplyAskHost />
      </>,
    );

    // job_3 (Zalando) is the first listing on page one that no web application points at.
    await user.click(
      await screen.findByRole('button', { name: 'Design Systems Engineer at Zalando, Berlin, DE' }),
    );
    const panel = await screen.findByRole(
      'region',
      { name: 'Design Systems Engineer at Zalando' },
      { timeout: 3000 },
    );
    const opened = jest.spyOn(window, 'open').mockReturnValue(null);
    await user.click(within(panel).getByRole('button', { name: /Apply Now/ }));
    expect(opened).toHaveBeenCalledTimes(1);
    opened.mockRestore();

    // NextKin submits nothing: the job joins the list only once the candidate says they applied.
    // Each mock call carries a simulated latency (up to 900ms), past `findBy`'s default margin.
    await user.click(
      await screen.findByRole('button', { name: 'Yes, I applied' }, { timeout: 3000 }),
    );
    expect(
      await within(panel).findByRole('link', { name: 'View application' }, { timeout: 3000 }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/applications\?application=/));
  });

  it('opens a deep-linked job, even a closed listing the list leaves out', async () => {
    // How an application's "View Job" lands here: Flipkart's listing has closed, so search no
    // longer returns it, but the link still opens it.
    renderWithQuery(<JobsScreen initialJobId="job_flipkart" />);

    const panel = await screen.findByRole(
      'region',
      { name: 'UX Designer at Flipkart' },
      { timeout: 3000 },
    );
    expect(
      await within(panel).findByRole('link', { name: 'View application' }, { timeout: 2000 }),
    ).toHaveAttribute('href', '/applications?application=app_web_flipkart');
    await screen.findByText('39 results', {}, { timeout: SETTLE_MS.normal * 2 });
    expect(
      screen.queryByRole('button', { name: 'UX Designer at Flipkart, Bengaluru, India' }),
    ).not.toBeInTheDocument();
  });

  it('switches detail tabs', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobsScreen />);

    const panel = await openPanel();

    await user.click(within(panel).getByRole('tab', { name: 'About' }));
    expect(await within(panel).findByText('google.com')).toBeInTheDocument();

    // The listing's own benefits, not "none listed" for a job that lists four (audit JB-07).
    await user.click(within(panel).getByRole('tab', { name: 'Benefits' }));
    expect(
      await within(panel).findByText('Health insurance for you and your family'),
    ).toBeInTheDocument();
    expect(
      within(panel).queryByText("This company hasn't listed benefits for this role."),
    ).toBeNull();
  });

  it("offers the three sorts under the web board's labels", async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobsScreen />);

    await screen.findByText('39 results', {}, { timeout: SETTLE_MS.normal * 2 });

    await user.click(screen.getByRole('button', { name: 'Most relevant' }));
    for (const label of ['Most relevant', 'Most recent', 'Salary']) {
      expect(await screen.findByRole('menuitemcheckbox', { name: label })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Most recent' }));
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: 'Most recent' })).toBeInTheDocument();
  });
});
