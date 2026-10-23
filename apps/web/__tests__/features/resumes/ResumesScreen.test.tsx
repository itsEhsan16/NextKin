import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ATS_BAND_LABEL } from '@nextkin/shared/models';
import { mockStore, resetMockRepos } from '@nextkin/shared/repos';

import { ResumesScreen } from '@/features/resumes/screens/ResumesScreen';
import { printDocument } from '@/lib/printDocument';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

jest.mock('@/lib/printDocument', () => ({ printDocument: jest.fn() }));

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
  usePathname: () => '/resumes',
  useSearchParams: () => new URLSearchParams(),
}));

/** The board's five rows (304:3126-3245), top to bottom under "Last updated", and their tags. */
const BOARD_ROWS = [
  ['Software Engineer Resume', 'Updated 2 days ago', 'Tailored', 'ATS Optimized'],
  ['Product Designer Resume', 'Updated 1 week ago', 'General', 'ATS Optimized'],
  ['Data Analyst Resume', 'Updated 2 weeks ago', 'Template', 'Draft'],
  ['Marketing Manager Resume', 'Updated 3 weeks ago', 'Tailored', 'ATS Optimized'],
  ['General Resume', 'Updated 1 month ago', 'General', 'Archived'],
] as const;

const TITLES = BOARD_ROWS.map(([title]) => title);

/** Every row's select button, in list order. The kebabs are the list's only other buttons. */
const rowNames = () =>
  within(screen.getByRole('list', { name: 'Resumes' }))
    .getAllByRole('button', { name: (name) => !name.startsWith('More options') })
    .map((button) => button.getAttribute('aria-label'));

const row = (name: string) => {
  const container = screen.getByRole('button', { name }).closest('div');
  expect(container).not.toBeNull();
  return within(container as HTMLElement);
};

const settle = () => screen.findByText('5 resumes found', {}, { timeout: SETTLE_MS.normal });

const panelFor = (name: string) => screen.findByRole('region', { name }, { timeout: 3000 });

describe('ResumesScreen', () => {
  // Creating a resume mutates the shared mock store's singleton, which otherwise leaks.
  beforeEach(() => {
    resetMockRepos();
    jest.mocked(printDocument).mockClear();
  });

  it('renders the board copy', () => {
    renderWithQuery(<ResumesScreen />);

    expect(
      screen.getByRole('heading', { name: 'Build a resume that gets you hired' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Create, customize, and manage your resumes for every opportunity.'),
    ).toBeInTheDocument();
    for (const label of ['Resume type', 'Last updated', 'Target role', 'Status']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort by: Last updated' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort resumes: Last updated' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search resumes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create New Resume' })).toBeInTheDocument();
  });

  it('shows the loading state before the mock layer settles', () => {
    renderWithQuery(<ResumesScreen />);

    expect(screen.queryByText(/resumes found$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Software Engineer Resume')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All Resumes', selected: true })).toBeInTheDocument();
  });

  it("lists the board's five rows with their tags, and opens the first", async () => {
    renderWithQuery(<ResumesScreen />);
    await settle();

    expect(rowNames()).toEqual(TITLES);
    for (const [title, updated, variant, state] of BOARD_ROWS) {
      expect(row(title).getByText(updated)).toBeInTheDocument();
      expect(row(title).getByText(variant)).toBeInTheDocument();
      expect(row(title).getByText(state)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: TITLES[0] })).toHaveAttribute('aria-current', 'true');

    // The rows win over the board's own pill counts, which read (2) and (0) (toreview.md §18).
    for (const name of [
      'All Resumes (5)',
      'Tailored (2)',
      'ATS Optimized (3)',
      'Drafts (1)',
      'Archived (1)',
    ]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }

    const panel = await panelFor('Software Engineer Resume');
    expect(
      within(panel).getByRole('heading', { level: 2, name: 'Software Engineer Resume' }),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Updated 2 days ago')).toBeInTheDocument();
    expect(within(panel).getByText('Tailored')).toBeInTheDocument();
    for (const meta of ['1 page', 'PDF', 'ATS Optimized', 'Tailored for Product Design roles']) {
      expect(within(panel).getByText(meta)).toBeInTheDocument();
    }
    expect(within(panel).getByRole('link', { name: 'Edit Resume' })).toHaveAttribute(
      'href',
      '/resumes/res_swe/edit',
    );
    expect(within(panel).getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Use for Job' })).toHaveAttribute(
      'href',
      '/jobs?job=job_google',
    );

    // The preview, as 304:3321 draws it.
    expect(
      await within(panel).findByText('George Smith', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    const contact = within(panel).getByRole('list', { name: 'Contact details' });
    for (const detail of [
      'george.smith@gmail.com',
      '+91 98765 43210',
      'Bengaluru, India',
      'linkedin.com/in/georgesmith',
    ]) {
      expect(within(contact).getByText(detail)).toBeInTheDocument();
    }
    expect(
      within(panel).getByText(/^Software Engineer with 4\+ years of experience building/),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Google • Bengaluru, India')).toBeInTheDocument();
    expect(within(panel).getByText('Jan 2022 – Present')).toBeInTheDocument();
    expect(within(panel).getByText('Adobe • Remote')).toBeInTheDocument();
    expect(
      within(panel).getByText('Received "Impact Award" for contributing to a key product launch.'),
    ).toBeInTheDocument();
  });

  it('narrows the list to one group', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ResumesScreen />);
    await settle();

    await user.click(screen.getByRole('tab', { name: 'Drafts (1)' }));

    expect(screen.getByText('1 resume found')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Data Analyst Resume']);
    // The open card follows the list.
    const panel = await panelFor('Data Analyst Resume');
    expect(
      await within(panel).findByText('Data Analyst', { selector: 'p' }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it('filters through a chip and resets', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ResumesScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: /^Resume type/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'General' }));
    // Radix hides the rest of the page from the accessibility tree while its menu is open.
    await user.keyboard('{Escape}');

    expect(await screen.findByText('2 resumes found')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Product Designer Resume', 'General Resume']);
    expect(screen.getByRole('tab', { name: 'All Resumes (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tailored (0)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(await screen.findByText('5 resumes found')).toBeInTheDocument();
  });

  it('searches from the panel', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ResumesScreen />);
    await settle();

    await user.type(screen.getByRole('searchbox', { name: 'Search resumes' }), 'marketing');

    expect(await screen.findByText('1 resume found')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Marketing Manager Resume']);
    expect(await panelFor('Marketing Manager Resume')).toBeInTheDocument();
  });

  it('re-sorts from either sort control', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ResumesScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'Sort by: Last updated' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Name' }));
    await user.keyboard('{Escape}');

    expect(await screen.findByRole('button', { name: 'Sort by: Name' })).toBeInTheDocument();
    // One order behind both controls.
    expect(screen.getByRole('button', { name: 'Sort resumes: Name' })).toBeInTheDocument();
    expect(rowNames()).toEqual([
      'Data Analyst Resume',
      'General Resume',
      'Marketing Manager Resume',
      'Product Designer Resume',
      'Software Engineer Resume',
    ]);
  });

  it('switches detail tabs', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ResumesScreen />);
    await settle();
    const panel = await panelFor('Software Engineer Resume');

    await user.click(within(panel).getByRole('tab', { name: 'Details' }));
    expect(within(panel).getByText('Target role')).toBeInTheDocument();
    expect(within(panel).getByText('Software Engineer')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'View the job' })).toHaveAttribute(
      'href',
      '/jobs?job=job_google',
    );

    // The engine's score (C-10): this software engineer's resume against Google's design JD, read
    // against a designer's profile, so Figma is a skill the profile backs and the resume lacks.
    const score = mockStore.state.atsScores.res_swe;
    if (!score) throw new Error('res_swe should be scored');
    await user.click(within(panel).getByRole('tab', { name: 'ATS Score' }));
    expect(
      await within(panel).findByRole(
        'img',
        { name: `ATS Score: ${score.total} out of 100` },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(within(panel).getByText(ATS_BAND_LABEL[score.band])).toBeInTheDocument();
    expect(within(panel).getByText('Missing: "Figma"')).toBeInTheDocument();

    await user.click(within(panel).getByRole('tab', { name: 'Version History' }));
    expect(await within(panel).findByText('Version 4', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(within(panel).getByText('Tightened the summary')).toBeInTheDocument();
    expect(within(panel).getByText('Current')).toBeInTheDocument();
  });

  it('says a draft has no score yet', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ResumesScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'Data Analyst Resume' }));
    const panel = await panelFor('Data Analyst Resume');
    await user.click(within(panel).getByRole('tab', { name: 'ATS Score' }));

    expect(within(panel).getByText('Not scored yet')).toBeInTheDocument();
  });

  it('asks how to start, makes nothing until Continue, and opens the editor (toreview §124)', async () => {
    const user = userEvent.setup();
    push.mockClear();
    renderWithQuery(<ResumesScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'Create New Resume' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a new resume' });
    const ways = within(dialog).getByRole('radiogroup', { name: 'How to start' });
    for (const option of [
      'Tailor to a job',
      'Build from my profile',
      'Upload existing',
      'Start from scratch',
    ]) {
      expect(within(ways).getByRole('radio', { name: new RegExp(option) })).toBeInTheDocument();
    }

    // Picking a way only selects it; nothing happens until Continue.
    await user.click(within(ways).getByRole('radio', { name: /Tailor to a job/ }));
    expect(within(ways).getByRole('radio', { name: /Tailor to a job/ })).toBeChecked();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'All Resumes (5)', hidden: true })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(push).toHaveBeenCalledWith('/create/tailor');

    // Cancel makes nothing either.
    await user.click(screen.getByRole('button', { name: 'Create New Resume' }));
    let again = await screen.findByRole('dialog', { name: 'Create a new resume' });
    await user.click(within(again).getByRole('radio', { name: /Start from scratch/ }));
    await user.click(within(again).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mockStore.state.resumes).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: 'Create New Resume' }));
    again = await screen.findByRole('dialog', { name: 'Create a new resume' });
    await user.click(within(again).getByRole('radio', { name: /Start from scratch/ }));
    await user.click(within(again).getByRole('button', { name: 'Continue' }));
    await waitFor(
      () =>
        expect(push).toHaveBeenLastCalledWith(
          expect.stringMatching(/^\/resumes\/res_[^/]+\/edit$/),
        ),
      { timeout: 3000 },
    );
    expect(mockStore.state.resumes).toHaveLength(6);
  });

  it('builds a resume from the profile and opens it in the editor (toreview §124)', async () => {
    const user = userEvent.setup();
    push.mockClear();
    renderWithQuery(<ResumesScreen />);
    await settle();
    await user.click(screen.getByRole('button', { name: 'Create New Resume' }));
    const choose = await screen.findByRole('dialog', { name: 'Create a new resume' });
    await user.click(within(choose).getByRole('radio', { name: /Build from my profile/ }));
    await user.click(within(choose).getByRole('button', { name: 'Continue' }));

    const dialog = await screen.findByRole('dialog', { name: 'Build from my profile' });
    const name = within(dialog).getByRole('textbox', { name: 'Resume name' });
    await user.clear(name);
    await user.type(name, 'Product Designer — General');
    await user.click(within(dialog).getByRole('button', { name: 'Create resume' }));
    await waitFor(() => expect(push).toHaveBeenLastCalledWith(expect.stringMatching(/\/edit$/)), {
      timeout: 15000,
    });
  }, 25000);

  it('renames from a row’s menu', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ResumesScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'More options for General Resume' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rename this resume' });
    const field = within(dialog).getByRole('textbox', { name: 'Name' });
    expect(field).toHaveValue('General Resume');
    await user.clear(field);
    await user.type(field, 'Generalist Resume');
    await user.click(within(dialog).getByRole('button', { name: 'Save name' }));

    expect(
      await screen.findByRole('button', { name: 'Generalist Resume' }, { timeout: 3000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mockStore.state.resumes.some((r) => r.title === 'Generalist Resume')).toBe(true);
  });

  it('duplicates and deletes from a row’s menu, deleting only after a confirmation', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ResumesScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'More options for Data Analyst Resume' }));
    const menu = await screen.findByRole('menu');
    for (const label of ['Edit', 'Rename', 'Duplicate', 'Download PDF', 'Delete']) {
      expect(within(menu).getByRole('menuitem', { name: label })).toBeInTheDocument();
    }
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }));
    expect(
      await screen.findByRole('tab', { name: 'All Resumes (6)' }, { timeout: 3000 }),
    ).toBeInTheDocument();

    const deleteDialog = 'Delete “Marketing Manager Resume”?';
    await user.click(
      screen.getByRole('button', { name: 'More options for Marketing Manager Resume' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: deleteDialog });
    expect(
      within(confirm).getByText('Its versions go with it. This can’t be undone.'),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Marketing Manager Resume' })).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'More options for Marketing Manager Resume' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: deleteDialog })).getByRole('button', {
        name: 'Delete resume',
      }),
    );
    await waitFor(
      () => expect(screen.queryByRole('button', { name: 'Marketing Manager Resume' })).toBeNull(),
      { timeout: 3000 },
    );
    // Gone from the store, not just from the list's optimistic copy.
    await waitFor(
      () =>
        expect(mockStore.state.resumes.some((r) => r.title === 'Marketing Manager Resume')).toBe(
          false,
        ),
      { timeout: 3000 },
    );
  });

  it('asks once whether the version is accurate, then downloads through the print dialog', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ResumesScreen />);
    await settle();
    const panel = await panelFor('Software Engineer Resume');

    // V2 §15 risk 2: the first download of a version asks first, in a dialog over the page;
    // "Not yet" leaves no file.
    await user.click(within(panel).getByRole('button', { name: 'Download' }));
    const prompt = await screen.findByRole(
      'dialog',
      { name: 'Is everything here true?' },
      { timeout: 3000 },
    );
    await user.click(within(prompt).getByRole('button', { name: 'Not yet' }));
    expect(printDocument).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Is everything here true?' })).toBeNull(),
    );

    await user.click(within(panel).getByRole('button', { name: 'Download' }));
    const again = await screen.findByRole(
      'dialog',
      { name: 'Is everything here true?' },
      { timeout: 3000 },
    );
    await user.click(within(again).getByRole('button', { name: 'Yes, it’s accurate' }));

    await waitFor(() => expect(printDocument).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const [html, fileName] = jest.mocked(printDocument).mock.calls[0] ?? [];
    expect(fileName).toBe('George_Smith_Software_Engineer.pdf');
    // The export prints what the preview shows: the headline, the contact line, the role's place.
    expect(html).toContain('Software Engineer');
    expect(html).toContain('george.smith@gmail.com');
    expect(html).toContain('Bengaluru, India · Jan 2022 – Present');
  });

  it('shows an empty state when there are no resumes at all', async () => {
    renderWithQuery(<ResumesScreen />, 'empty');

    expect(
      await screen.findByText('No resumes yet', {}, { timeout: SETTLE_MS.empty }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nothing to preview yet')).toBeInTheDocument();
  });

  it('shows the page-level error state when the user query fails', async () => {
    renderWithQuery(<ResumesScreen />, 'error');

    expect(
      await screen.findByText('Something went wrong', {}, { timeout: SETTLE_MS.error }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('opens the resume a link names (?resume=, `toreview.md` §102)', async () => {
    renderWithQuery(<ResumesScreen initialId="res_mm" />);
    expect(await panelFor('Marketing Manager Resume')).toBeInTheDocument();
  });
});
