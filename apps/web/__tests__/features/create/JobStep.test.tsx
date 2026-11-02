import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { JobFlowScreen } from '@/features/create/jobFlow/JobFlowScreen';
import { SAMPLE_JD } from '@/features/upload/uploadLibrary';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
  usePathname: () => '/create/build',
  useSearchParams: () => new URLSearchParams(),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };

/** toreview §126: step 1 of the job-first flows — a saved job, or one from anywhere. */
describe('Choose the job', () => {
  beforeEach(() => {
    resetMockRepos();
    push.mockClear();
  });

  it('picks the newest saved job and goes on to compare it, for Build', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobFlowScreen flow="build" />);
    expect(
      screen.getByRole('heading', { name: 'Let’s start with the job' }),
    ).toBeInTheDocument();
    const list = await screen.findByRole('radiogroup', { name: 'Your saved jobs' }, wait);
    const [first, second] = within(list).getAllByRole('radio');
    expect(first).toHaveAttribute('aria-checked', 'true');
    await user.click(second!);
    expect(second).toHaveAttribute('aria-checked', 'true');
    expect(first).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/jobs\/.+\/tailor\?mode=build$/));
  });

  it('reads a pasted job instead, for Tailor', async () => {
    const user = userEvent.setup();
    renderWithQuery(<JobFlowScreen flow="tailor" />);
    await screen.findByRole('radiogroup', { name: 'Your saved jobs' }, wait);
    await user.click(screen.getByRole('textbox', { name: 'Job description or link' }));
    await user.paste(SAMPLE_JD);
    // Typing in the other box takes the pick off the saved job.
    expect(
      screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false'),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await waitFor(
      () => expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/jd\/.+\/tailor$/)),
      wait,
    );
  }, 15000);
});
