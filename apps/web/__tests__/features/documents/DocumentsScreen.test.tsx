import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { DocumentsScreen } from '@/features/documents/screens/DocumentsScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

/** The seven rows the board draws (286:2119-2215), top to bottom under "Last updated". */
const BOARD_ROWS = [
  ['Software Engineer Certificate', 'Certificate • 2.4 MB • Updated 2 days ago', 'Certificate'],
  ['Cover Letter - Google', 'Cover Letter • 245 KB • Updated 1 week ago', 'Cover Letter'],
  ['Passport', 'ID Proof • 1.1 MB • Updated 2 weeks ago', 'ID Proof'],
  ['Portfolio Links', 'Other • 18 KB • Updated 2 weeks ago', 'Other'],
  ['Resume - Product Designer', 'Resume • 320 KB • Updated 3 weeks ago', 'Resume'],
  ['Academic Transcript', 'Certificate • 1.8 MB • Updated 1 month ago', 'Certificate'],
  ['Profile Photo', 'Other • 420 KB • Updated 1 month ago', 'Other'],
] as const;

/** Every row's select button, in list order. The kebabs are the list's only other buttons. */
const rowNames = () =>
  within(screen.getByRole('list', { name: 'Documents' }))
    .getAllByRole('button', { name: (name) => name !== 'More options' })
    .map((button) => button.getAttribute('aria-label'));

const row = (name: string) => {
  const container = screen.getByRole('button', { name }).closest('div');
  expect(container).not.toBeNull();
  return within(container as HTMLElement);
};

const settle = () => screen.findByText('12 documents', {}, { timeout: SETTLE_MS.normal });

const panelFor = (name: string) => screen.findByRole('region', { name }, { timeout: 3000 });

describe('DocumentsScreen', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('renders the board copy', () => {
    renderWithQuery(<DocumentsScreen />);

    expect(
      screen.getByRole('heading', { name: 'Keep everything in one place' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Organize your important career documents and access them anytime.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search documents' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sort documents: Last updated' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort by: Last updated' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows the loading state before the mock layer settles', () => {
    renderWithQuery(<DocumentsScreen />);

    expect(screen.queryByText(/documents$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Passport')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All Documents', selected: true })).toBeInTheDocument();
  });

  it("lists the board's seven rows first and opens the certificate", async () => {
    renderWithQuery(<DocumentsScreen />);
    await settle();

    expect(rowNames().slice(0, BOARD_ROWS.length)).toEqual(BOARD_ROWS.map(([title]) => title));
    for (const [title, meta, tag] of BOARD_ROWS) {
      expect(row(title).getByText(meta)).toBeInTheDocument();
      expect(row(title).getByText(tag)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: BOARD_ROWS[0][0] })).toHaveAttribute(
      'aria-current',
      'true',
    );

    for (const name of [
      'All Documents (12)',
      'Certificates (4)',
      'Cover Letters (3)',
      'ID Proofs (2)',
      'Other (3)',
    ]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }

    const panel = await panelFor('Software Engineer Certificate');
    expect(
      within(panel).getByRole('heading', { level: 2, name: 'Software Engineer Certificate' }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText('Certificate • 2.4 MB • Updated 2 days ago'),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/documents/doc_swe_certificate',
    );
    for (const name of ['Download', 'Share', 'More actions']) {
      expect(within(panel).getByRole('button', { name })).toBeInTheDocument();
    }

    // The certificate, as 286:2251 draws it.
    for (const text of [
      'Google Career Certificates',
      'Software Engineering',
      'George Smith',
      'Mar 15, 2024',
      'Date of completion',
      'Thomas Kurian',
      'CEO, Google Cloud',
    ]) {
      expect(within(panel).getByText(text)).toBeInTheDocument();
    }
    expect(
      within(panel).getByText(/^has successfully completed the Google Software Engineering/),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /Use this document in your applications/ }),
    ).toHaveAttribute('href', '/jobs');
  });

  it('narrows the list to one group, with the résumé under Other', async () => {
    const user = userEvent.setup();
    renderWithQuery(<DocumentsScreen />);
    await settle();

    await user.click(screen.getByRole('tab', { name: 'ID Proofs (2)' }));
    expect(screen.getByText('2 documents')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Passport', 'Aadhaar Card']);
    // The card follows the list, and says when it can't draw the file.
    const panel = await panelFor('Passport');
    expect(within(panel).getByText('No preview for this file')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Other (3)' }));
    expect(rowNames()).toEqual(['Portfolio Links', 'Resume - Product Designer', 'Profile Photo']);
  });

  it('searches, and the pills count what the search leaves', async () => {
    const user = userEvent.setup();
    renderWithQuery(<DocumentsScreen />);
    await settle();

    await user.type(screen.getByRole('searchbox', { name: 'Search documents' }), 'cover');

    expect(await screen.findByText('3 documents')).toBeInTheDocument();
    expect(rowNames()).toEqual([
      'Cover Letter - Google',
      'Cover Letter - CRED',
      'Cover Letter - Zoho',
    ]);
    expect(screen.getByRole('tab', { name: 'All Documents (3)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Certificates (0)' })).toBeInTheDocument();
  });

  it('re-sorts from either sort control', async () => {
    const user = userEvent.setup();
    renderWithQuery(<DocumentsScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'Sort documents: Last updated' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Name' }));
    await user.keyboard('{Escape}');

    expect(await screen.findByRole('button', { name: 'Sort by: Name' })).toBeInTheDocument();
    expect(rowNames().slice(0, 3)).toEqual([
      'Aadhaar Card',
      'Academic Transcript',
      'AWS Cloud Practitioner Certificate',
    ]);
  });

  it('switches to the grid and back', async () => {
    const user = userEvent.setup();
    renderWithQuery(<DocumentsScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('list', { name: 'Documents' })).toHaveClass('grid');
    expect(rowNames()).toHaveLength(12);

    await user.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByRole('list', { name: 'Documents' })).not.toHaveClass('grid');
  });

  it('shows the photo as itself', async () => {
    const user = userEvent.setup();
    renderWithQuery(<DocumentsScreen />);
    await settle();

    await user.click(screen.getByRole('button', { name: 'Profile Photo' }));
    const panel = await panelFor('Profile Photo');
    expect(within(panel).getByRole('img', { name: 'Profile Photo' })).toBeInTheDocument();
  });

  it('shows an empty state when there are no documents at all', async () => {
    renderWithQuery(<DocumentsScreen />, 'empty');

    expect(
      await screen.findByText('No documents yet', {}, { timeout: SETTLE_MS.empty }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nothing to preview yet')).toBeInTheDocument();
  });

  it('shows the page-level error state when the user query fails', async () => {
    renderWithQuery(<DocumentsScreen />, 'error');

    expect(
      await screen.findByText('Something went wrong', {}, { timeout: SETTLE_MS.error }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
