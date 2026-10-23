import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { toWrite } from '@/features/editor/editorModel';
import { EditorRoute } from '@/features/editor/screens/EditorRoute';
import { renderWithQuery } from '../../../testSupport/render';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/resumes/res_pd/edit',
  useSearchParams: () => new URLSearchParams(),
}));

/** toreview §124: the editor's download checklist (EDIT 02) and its banners (EDIT 03). */

const wait = { timeout: 4000 };
const open = async (id = 'res_pd') => {
  renderWithQuery(<EditorRoute id={id} />);
  return screen.findByRole('region', { name: 'Header' }, wait);
};
const toggle = (heading: string) => {
  const button = within(screen.getByRole('region', { name: heading }))
    .getAllByRole('button', { name: new RegExp(`^${heading}`) })
    .find((b) => b.hasAttribute('aria-expanded'));
  if (!button) throw new Error(`No heading button for ${heading}`);
  return button;
};
/** The Google role's row, which keeps its title when its company is cleared. */
const googleRole = () => {
  const row = within(screen.getByRole('region', { name: 'Experience' }))
    .getAllByRole('button', { name: /^Software Engineer( · Google)?\b/ })
    .find((b) => b.hasAttribute('aria-expanded'));
  if (!row) throw new Error('No row for the Google role');
  return row;
};
const saved = () => screen.findByText(/All changes saved/, {}, { timeout: 5000 });

describe('the resume editor’s checklist and banners', () => {
  // jsdom has no scrolling; "Go to it" scrolls the section into view.
  const scrollIntoView = jest.fn();
  beforeAll(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  beforeEach(() => {
    resetMockRepos();
    scrollIntoView.mockClear();
    window.localStorage.clear();
  });

  it('lists what a download still needs, and "Go to it" opens the closed section', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(toggle('Header'));
    await user.clear(screen.getByRole('textbox', { name: 'Full name' }));
    await user.click(toggle('Header'));
    expect(toggle('Header')).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    const dialog = await screen.findByRole('dialog', { name: 'A few things before you download' });
    // Each problem sits under its section's heading.
    const problem = within(dialog).getByRole('button', { name: /Add your name at the top/ });
    expect(problem).toHaveTextContent(/^Header/);
    expect(problem).toHaveTextContent(/Go to it$/);

    await user.click(problem);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(toggle('Header')).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(scrollIntoView.mock.contexts.at(-1)).toHaveAttribute('id', 'editor-header');
    // The cleared name still autosaves; let it land before the store is reset for the next test.
    expect(await saved()).toBeInTheDocument();
  }, 15000);

  it('"Go to it" opens the closed role a problem is in', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(googleRole());
    const experience = screen.getByRole('region', { name: 'Experience' });
    await user.clear(within(experience).getAllByRole('textbox', { name: 'Company' })[0]!);
    await user.click(toggle('Experience'));
    await user.click(googleRole());
    expect(googleRole()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle('Experience')).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    const dialog = await screen.findByRole('dialog', { name: 'A few things before you download' });
    const problem = within(dialog).getByRole('button', { name: /add the employer/ });
    expect(problem).toHaveTextContent(/^Experience/);
    await user.click(problem);

    await waitFor(() => expect(toggle('Experience')).toHaveAttribute('aria-expanded', 'true'));
    expect(googleRole()).toHaveAttribute('aria-expanded', 'true');
    expect(await saved()).toBeInTheDocument();
  }, 15000);

  it('stops when the resume changed elsewhere, copies my edits, and loads the latest', async () => {
    const user = userEvent.setup();
    // After setup: user-event installs its own clipboard on `navigator`.
    const writeText = jest.spyOn(navigator.clipboard, 'writeText');
    await open();
    // Another tab saves first.
    const current = await repos.resumes.getDocument('res_pd');
    await repos.resumes.saveDocument(
      'res_pd',
      { ...toWrite(current), summary: 'From the other tab.' },
      current.revision,
    );

    await user.type(screen.getByRole('textbox', { name: 'Summary' }), ' More.');
    const title = await screen.findByText(
      'This resume changed somewhere else',
      {},
      { timeout: 5000 },
    );
    const banner = title.closest('[role="alert"]') as HTMLElement;
    expect(banner).not.toBeNull();
    expect(within(banner).queryByRole('button', { name: /Keep my version/ })).toBeNull();

    await user.click(within(banner).getByRole('button', { name: 'Copy my edits' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0]?.[0] ?? '';
    expect(copied).toContain('SUMMARY');
    expect(copied).toContain('cares about the details users feel. More.');
    expect(copied).not.toContain('From the other tab.');

    await user.click(within(banner).getByRole('button', { name: 'Load the latest' }));
    await waitFor(
      () =>
        expect(screen.getByRole('textbox', { name: 'Summary' })).toHaveValue('From the other tab.'),
      wait,
    );
    await waitFor(() =>
      expect(screen.queryByText('This resume changed somewhere else')).toBeNull(),
    );
    writeText.mockRestore();
  }, 20000);

  const keepBackup = async () => {
    const current = await repos.resumes.getDocument('res_pd');
    window.localStorage.setItem(
      'nextkin:editor:res_pd',
      JSON.stringify({
        revision: current.revision,
        write: { ...toWrite(current), summary: 'Typed before the tab closed.' },
        at: new Date().toISOString(),
      }),
    );
  };
  const restoreBanner = async () =>
    (await screen.findByText('Restore your unsaved changes?', {}, wait)).closest(
      '[role="status"]',
    ) as HTMLElement;

  it('offers back edits that never reached us, and restores them', async () => {
    const user = userEvent.setup();
    await keepBackup();
    await open();
    const banner = await restoreBanner();
    await user.click(within(banner).getByRole('button', { name: 'Restore' }));

    expect(screen.getByRole('textbox', { name: 'Summary' })).toHaveValue(
      'Typed before the tab closed.',
    );
    expect(screen.queryByText('Restore your unsaved changes?')).toBeNull();
    expect(await saved()).toBeInTheDocument();
    await waitFor(async () =>
      expect((await repos.resumes.getDocument('res_pd')).summary).toBe(
        'Typed before the tab closed.',
      ),
    );
  }, 15000);

  it('discards the kept edits when asked', async () => {
    const user = userEvent.setup();
    await keepBackup();
    await open();
    const banner = await restoreBanner();
    await user.click(within(banner).getByRole('button', { name: 'Discard' }));

    expect(screen.queryByText('Restore your unsaved changes?')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Summary' })).not.toHaveValue(
      'Typed before the tab closed.',
    );
    expect(window.localStorage.getItem('nextkin:editor:res_pd')).toBeNull();
  });
});
