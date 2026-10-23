import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockStore, repos, resetMockRepos } from '@nextkin/shared/repos';

import { EditorRoute } from '@/features/editor/screens/EditorRoute';
import { renderWithQuery } from '../../../testSupport/render';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/resumes/letter/edit',
  useSearchParams: () => new URLSearchParams(),
}));

/** toreview §124, EDIT 04: a cover letter opens its own editor, edits live and saves itself. */

const wait = { timeout: 4000 };
const letterPreview = () => screen.getByRole('region', { name: 'Letter preview' });

describe('the letter editor', () => {
  beforeEach(() => resetMockRepos());

  it('edits the letter live, saves it by itself, and undoes', async () => {
    const user = userEvent.setup();
    const letter = await repos.resumes.create({
      title: 'Letter for Stripe',
      docType: 'cover_letter',
    });
    renderWithQuery(<EditorRoute id={letter.id} />);

    const greeting = await screen.findByRole('textbox', { name: 'Greeting' }, wait);
    // An empty letter still previews with the defaults it prints.
    expect(within(letterPreview()).getByText('Dear Hiring Manager,')).toBeInTheDocument();
    expect(
      within(letterPreview()).getByRole('tab', { name: 'Live preview', selected: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Header' })).toBeNull();

    await user.type(greeting, 'Dear Priya,');
    await user.click(screen.getByRole('button', { name: 'Add a paragraph' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Paragraph 1' }),
      'I build checkout flows.',
    );
    await user.type(screen.getByRole('textbox', { name: 'Sign-off' }), 'Best,');
    expect(within(letterPreview()).getByText('Dear Priya,')).toBeInTheDocument();
    expect(within(letterPreview()).getByText('I build checkout flows.')).toBeInTheDocument();

    await waitFor(
      () =>
        expect(mockStore.state.contents[letter.id]).toMatchObject({
          greeting: 'Dear Priya,',
          paragraphs: ['I build checkout flows.'],
        }),
      { timeout: 5000 },
    );

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('textbox', { name: 'Sign-off' })).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('textbox', { name: 'Sign-off' })).toHaveValue('Best,');
  }, 20000);
});
