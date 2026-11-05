import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { PromptDetailScreen } from '@/features/admin/content/screens/PromptDetailScreen';
import { PromptsScreen } from '@/features/admin/content/screens/PromptsScreen';
import { renderWithQuery, SETTLE_MS } from '../../../../testSupport/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: jest.fn() }),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };

describe('AI prompts (Figma 406:662)', () => {
  beforeEach(() => resetMockRepos());

  it('lists the nine stages and narrows to the one failing its eval', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptsScreen />);

    const table = await screen.findByRole('table', {}, wait);
    expect(within(table).getAllByRole('row')).toHaveLength(10);
    expect(within(table).getByText('v15 draft')).toBeInTheDocument();
    expect(within(table).getByText('ready to publish')).toBeInTheDocument();
    expect(within(table).getByText('v11 · below 0.85')).toBeInTheDocument();
    expect(screen.getByText('cover.write · zero.build')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Failing eval/ }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /assistant\.chat/ })).toHaveAttribute(
      'href',
      '/admin/prompts/assistant.chat',
    );
  });

  it('shows an error with a retry when the stages fail to load', async () => {
    renderWithQuery(<PromptsScreen />, 'error');
    expect(
      await screen.findByText('Couldn’t load the prompts', {}, { timeout: SETTLE_MS.error * 3 }),
    ).toBeInTheDocument();
  });
});

describe('Prompt detail (Figma 407:3141)', () => {
  beforeEach(() => resetMockRepos());

  it('shows the draft’s eval and publishes it once confirmed', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptDetailScreen name="tailor.rewrite" />);

    expect(
      await screen.findByText(
        'Rewrites resume bullets toward the job. Active v14 since Nov 5 · Draft v15 by Marco K.',
        {},
        wait,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Passed · threshold 0.85')).toBeInTheDocument();
    expect(screen.getByText('below 0.85')).toBeInTheDocument();
    expect(
      (screen.getByRole('textbox', { name: 'System prompt text' }) as HTMLTextAreaElement).value,
    ).toContain('{{keywords.ticked}}');

    await user.click(screen.getByRole('button', { name: 'Publish v15' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish tailor.rewrite v15?' });
    await user.click(within(dialog).getByRole('button', { name: 'Publish v15' }));

    await waitFor(
      () => expect(screen.queryByRole('button', { name: 'Publish v15' })).not.toBeInTheDocument(),
      wait,
    );
    expect(await screen.findByText(/Active v15 since/, {}, wait)).toBeInTheDocument();
  }, 20_000);

  it('asks for an eval once an edited draft has none', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptDetailScreen name="cover.write" />);

    expect(await screen.findByText('Not evaluated yet', {}, wait)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publish v8' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish cover.write v8?' });
    expect(within(dialog).getByText(/hasn't passed an eval yet/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Publish v8' })).toBeDisabled();
  });

  it('saves an edit still waiting on its autosave when the page goes', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithQuery(<PromptDetailScreen name="cover.write" />);
    const field = await screen.findByRole('textbox', { name: 'System prompt text' }, wait);
    await user.type(field, ' Kept on leave.');
    unmount();
    await waitFor(
      async () =>
        expect((await repos.adminContent.getPrompt('cover.write')).editor.system).toContain(
          'Kept on leave.',
        ),
      wait,
    );
  }, 20_000);

  it('offers a retry when the prompt fails to load', async () => {
    renderWithQuery(<PromptDetailScreen name="tailor.rewrite" />, 'error');
    expect(
      await screen.findByRole('button', { name: 'Try again' }, { timeout: SETTLE_MS.error * 3 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to AI prompts' })).toHaveAttribute(
      'href',
      '/admin/prompts',
    );
  });
});
