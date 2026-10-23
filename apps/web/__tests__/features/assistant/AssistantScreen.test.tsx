import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { AssistantScreen } from '@/features/assistant/screens/AssistantScreen';
import { Toaster } from '@/ui/Toaster';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const wait = { timeout: SETTLE_MS.normal * 3 };

const render = () =>
  renderWithQuery(
    <>
      <AssistantScreen />
      <Toaster />
    </>,
  );

const history = () => screen.getByRole('region', { name: /History/ });

describe('AssistantScreen (767:2, 767:275, 772:2, 772:165)', () => {
  beforeEach(() => {
    resetMockRepos();
  });

  it('shows the chat, the History with it lit, and the day’s messages', async () => {
    render();
    const conversation = await screen.findByRole('list', { name: 'Conversation' }, wait);

    expect(
      within(conversation).getByText('How do I explain a two-year gap on my resume?'),
    ).toBeInTheDocument();
    expect(within(conversation).getByText('Out of scope')).toBeInTheDocument();
    expect(within(conversation).getByText('Today')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Try asking' })).toBeInTheDocument();

    await within(history()).findByText('Should I list freelance work?', {}, wait);
    expect(within(history()).getAllByRole('listitem')).toHaveLength(6);
    expect(within(history()).getByRole('button', { current: true })).toHaveTextContent(
      'Explaining a two-year gap',
    );
    expect(within(history()).getByText('(6)')).toBeInTheDocument();

    expect(screen.getByText('12 / 20')).toBeInTheDocument();
    expect(screen.getByText('8 left today on Free')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See Pro plans' })).toHaveAttribute(
      'href',
      '/settings?tab=billing',
    );
    expect(screen.getByText('Read and advise only')).toBeInTheDocument();
  });

  it('asks a prompt, and the question lands in the chat', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByRole('list', { name: 'Conversation' }, wait);

    await user.click(screen.getByRole('button', { name: 'How do I explain a career gap?' }));
    const conversation = screen.getByRole('list', { name: 'Conversation' });
    expect(
      await within(conversation).findByText('How do I explain a career gap?', {}, wait),
    ).toBeInTheDocument();
  });

  it('starts a new chat on the welcome, and reopens an earlier one', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByRole('list', { name: 'Conversation' }, wait);

    await user.click(within(history()).getByRole('button', { name: 'New chat' }));
    expect(
      await screen.findByRole('heading', { name: 'Hi George, how can I help?' }, wait),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Topics' })).toBeInTheDocument();

    // A topic starts the question in the composer rather than sending it.
    await user.click(screen.getByRole('button', { name: /Interview prep/ }));
    expect(screen.getByRole('textbox', { name: 'Ask a question' })).toHaveValue(
      'Help me prepare for an interview: ',
    );

    await user.click(within(history()).getByRole('button', { name: /Why my ATS score is 72/ }));
    expect(
      await screen.findByText(/^Your score is held back by three keywords/, {}, wait),
    ).toBeInTheDocument();
    expect(within(history()).getByRole('button', { current: true })).toHaveTextContent(
      'Why my ATS score is 72',
    );
  });

  it('attaches a resume from the menu, and takes it off again', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByRole('list', { name: 'Conversation' }, wait);

    await user.click(screen.getByRole('button', { name: 'Add to your message' }));
    const resumes = await screen.findByRole('menuitem', { name: /A resume on NextKin/ });
    await user.click(resumes);
    // Radix picks on pointer-up, which jsdom doesn't dispatch; the keyboard path is the same pick.
    (
      await screen.findByRole('menuitem', { name: /^Software Engineer Resume\s*For Google/ })
    ).focus();
    await user.keyboard('{Enter}');

    const attached = await screen.findByRole('list', { name: 'Attached' });
    expect(within(attached).getByText('Software Engineer Resume')).toBeInTheDocument();
    expect(within(attached).getByText('Resume on NextKin · 1 page')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Software Engineer Resume' }));
    expect(screen.queryByRole('list', { name: 'Attached' })).toBeNull();
  });

  it('opens with the job a link names already attached (?job=, `toreview.md` §102)', async () => {
    renderWithQuery(<AssistantScreen jobId="job_google" />);
    const attached = await screen.findByRole('list', { name: 'Attached' }, wait);
    expect(within(attached).getByText('Google — Lead UX Designer')).toBeInTheDocument();
  });
});
