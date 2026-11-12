import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockStore, repos, resetMockRepos } from '@nextkin/shared/repos';

import { EditorRoute } from '@/features/editor/screens/EditorRoute';
import { renderWithQuery } from '../../../testSupport/render';

const push = jest.fn();
const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/resumes/res_pd/edit',
  useSearchParams: () => new URLSearchParams(),
}));

/** toreview §124: the resume editor on the mock — open, edit, autosave, undo, template, lines. */

const wait = { timeout: 4000 };
const SECTIONS = [
  'Header',
  'Summary',
  'Skills',
  'Work Experience',
  'Projects',
  'Education',
  'Certifications',
];
const open = async (id = 'res_pd') => {
  renderWithQuery(<EditorRoute id={id} />);
  return screen.findByRole('region', { name: 'Header' }, wait);
};
/** A section's heading button, which opens and closes it: the first one that does either. */
const toggle = (heading: string) => {
  const button = within(screen.getByRole('region', { name: heading }))
    .getAllByRole('button', { name: new RegExp(`^${heading}`) })
    .find((b) => b.hasAttribute('aria-expanded'));
  if (!button) throw new Error(`No heading button for ${heading}`);
  return button;
};
/** A role's row in Experience, which opens and closes its form. */
const entry = (company: RegExp) =>
  within(screen.getByRole('region', { name: 'Work Experience' })).getByRole('button', {
    name: company,
    expanded: false,
  });
const preview = () => screen.getByRole('article', { name: 'Live preview of your resume' });
const contentOf = (id: string) => mockStore.state.contents[id];

describe('the resume editor', () => {
  beforeEach(() => {
    resetMockRepos();
    push.mockClear();
    replace.mockClear();
    window.localStorage.clear();
  });

  it('opens the resume with every section, the live page and the save status', async () => {
    const user = userEvent.setup();
    await open();
    // The title is a heading; the rename button is its control (redesign R6c, ED-12). This is the
    // base resume, and the top bar says so (ED-03), with the history a press away (ED-07).
    expect(
      screen.getByRole('heading', { level: 1, name: 'Product Designer Resume' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename resume' })).toBeInTheDocument();
    expect(screen.getByText('Base resume')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Version history' })).toBeInTheDocument();
    expect(screen.getByText('1 page')).toBeInTheDocument();
    for (const heading of SECTIONS) {
      expect(screen.getByRole('region', { name: heading })).toBeInTheDocument();
    }
    // Each heading carries a count of what the section holds.
    expect(toggle('Work Experience')).toHaveTextContent('2 roles');
    expect(toggle('Certifications')).toHaveTextContent('Empty — left off the page');

    // A filled-in resume opens Summary and Experience only; its roles start closed.
    for (const heading of SECTIONS) {
      expect(toggle(heading)).toHaveAttribute(
        'aria-expanded',
        String(heading === 'Summary' || heading === 'Work Experience'),
      );
    }
    expect(entry(/· Google/)).toHaveAttribute('aria-expanded', 'false');
    expect(entry(/· Adobe/)).toHaveAttribute('aria-expanded', 'false');

    // The top bar holds undo, redo and Download PDF; the rest lives in the Resumes list.
    expect(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
    // The template switch sits on the preview's toolbar.
    const pane = screen.getByRole('region', { name: 'Preview' });
    expect(within(pane).getByRole('tab', { name: 'Live preview', selected: true })).toBeVisible();
    expect(within(pane).getByRole('tab', { name: 'PDF pages' })).toBeInTheDocument();
    expect(within(pane).getByRole('button', { name: 'Template: Classic' })).toBeInTheDocument();

    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('All changes saved');
    await user.click(toggle('Header'));
    expect(toggle('Header')).toHaveAttribute('aria-expanded', 'true');
    expect(within(preview()).getByRole('heading', { level: 1 })).toHaveTextContent(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Full name' }).value,
    );
  });

  it('says base or copy until dismissed, and lists versions without restoring them (ED-04, ED-07)', async () => {
    const user = userEvent.setup();
    await open();
    expect(
      screen.getByText(/Tailored copies already made keep their own text/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/Tailored copies already made/)).toBeNull();
    expect(window.localStorage.getItem('nextkin:editor-copy-note:res_pd')).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Version history' }));
    const drawer = await screen.findByRole('dialog', { name: 'Version history' });
    expect(await within(drawer).findByText('Version 3', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Restore this version' })).toBeNull();
  }, 15000);

  it('opens every section of a blank resume', async () => {
    const blank = await repos.resumes.create({ title: 'Untitled resume', docType: 'resume' });
    await open(blank.id);
    for (const heading of SECTIONS) {
      expect(toggle(heading)).toHaveAttribute('aria-expanded', 'true');
    }
    expect(toggle('Work Experience')).toHaveTextContent('Empty — left off the page');
  });

  it('saves a change by itself, shows it live, and undoes and redoes it', async () => {
    const user = userEvent.setup();
    await open();
    const summary = screen.getByRole('textbox', { name: 'Summary' });
    await user.clear(summary);
    await user.type(summary, 'Designer who ships.');
    expect(within(preview()).getByText('Designer who ships.')).toBeInTheDocument();
    expect(await screen.findByText(/All changes saved/, {}, wait)).toBeInTheDocument();
    await waitFor(
      () => expect(contentOf('res_pd')).toMatchObject({ summary: 'Designer who ships.' }),
      wait,
    );

    await user.click(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }));
    expect(screen.getByRole('textbox', { name: 'Summary' })).not.toHaveValue('Designer who ships.');
    await user.click(screen.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' }));
    expect(screen.getByRole('textbox', { name: 'Summary' })).toHaveValue('Designer who ships.');
    expect(await screen.findByText(/All changes saved/, {}, wait)).toBeInTheDocument();
  }, 20000);

  it('adds a role, switches the template and keeps both after a reload', async () => {
    const user = userEvent.setup();
    await open();
    const experience = screen.getByRole('region', { name: 'Work Experience' });
    await user.click(within(experience).getByRole('button', { name: 'Add a role' }));
    // A new, empty role opens by itself.
    expect(within(experience).getByRole('button', { name: /^New role/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.type(
      within(experience).getAllByRole('textbox', { name: 'Job title' })[0]!,
      'Design Lead',
    );
    await user.type(
      within(experience).getAllByRole('textbox', { name: 'Company' })[0]!,
      'Northwind',
    );
    expect(within(experience).getAllByRole('button', { name: /^Start/ })[0]).toBeInTheDocument();
    expect(within(experience).getAllByRole('button', { name: /^End/ })[0]).toBeDisabled();
    expect(within(preview()).getByText('Northwind')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Template: Classic' }));
    await user.click(await screen.findByRole('menuitem', { name: /Modern/ }));
    expect(screen.getByRole('button', { name: 'Template: Modern' })).toBeInTheDocument();
    expect(await screen.findByText(/All changes saved/, {}, { timeout: 5000 })).toBeInTheDocument();

    const doc = await repos.resumes.getDocument('res_pd');
    expect(doc.template).toBe('modern');
    expect(doc.experience[0]).toMatchObject({ company: 'Northwind', title: 'Design Lead' });
  }, 20000);

  it('moves a line with the arrow keys on its handle and removes it with its bin', async () => {
    const user = userEvent.setup();
    await open();
    const experience = screen.getByRole('region', { name: 'Work Experience' });
    const role = entry(/· Google/);
    await user.click(role);
    expect(role).toHaveAttribute('aria-expanded', 'true');

    const line = (n: number) =>
      within(experience).getAllByRole<HTMLTextAreaElement>('textbox', {
        name: `What you did, line ${n}`,
      })[0]!;
    const first = line(1).value;
    const second = line(2).value;
    expect(first).not.toBe(second);

    const handle = within(experience).getAllByRole('button', {
      name: 'Move line 1: drag, or use the arrow keys',
    })[0]!;
    handle.focus();
    await user.keyboard('{ArrowDown}');
    expect(line(1)).toHaveValue(second);
    expect(line(2)).toHaveValue(first);
    // The top line can't go higher.
    within(experience)
      .getAllByRole('button', { name: 'Move line 1: drag, or use the arrow keys' })[0]!
      .focus();
    await user.keyboard('{ArrowUp}');
    expect(line(1)).toHaveValue(second);

    await user.click(within(experience).getAllByRole('button', { name: 'Remove line 1' })[0]!);
    expect(line(1)).toHaveValue(first);
    expect(await screen.findByText(/All changes saved/, {}, { timeout: 5000 })).toBeInTheDocument();
  }, 20000);
});
