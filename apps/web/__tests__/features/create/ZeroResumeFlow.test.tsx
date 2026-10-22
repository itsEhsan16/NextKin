import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetMockRepos } from '@nextkin/shared/repos';

import { ZeroResumeScreen } from '@/features/create/screens/ZeroResumeScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';
import { finishedRun } from '../../../testSupport/runs';

const replace = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/create/zero-resume',
  useSearchParams: () => new URLSearchParams(),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };
const SEED = {
  fullName: 'George Smith',
  yearsBand: '6-10' as const,
  yearsExperience: 8,
  targetTitle: 'Product Designer',
};

/** toreview §125: Home's Zero Resume tile, mobile's ZERO 01–05 on the web. */
describe('Zero Resume', () => {
  beforeEach(() => {
    resetMockRepos();
    replace.mockClear();
  });

  it('asks three things, says what is missing, then starts the draft', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ZeroResumeScreen role="Product Designer" />);
    const name = await screen.findByRole('textbox', { name: 'Your name' }, wait);
    await waitFor(() => expect(name).not.toHaveValue(''), wait);
    expect(screen.getByRole('textbox', { name: 'The role you want' })).toHaveValue(
      'Product Designer',
    );

    await user.click(screen.getByRole('button', { name: /Write my first draft/ }));
    expect(
      screen.getByText('Pick how long you have worked. None is a fine answer.'),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: '3–5 yrs' }));
    await user.click(screen.getByRole('button', { name: /Write my first draft/ }));
    await waitFor(
      () =>
        expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/create\/zero-resume\?run=/)),
      wait,
    );
  }, 15000);

  it('walks every guess, keeps Download locked until the last, then opens it', async () => {
    const user = userEvent.setup();
    const id = await finishedRun({ kind: 'zero_resume', zero: SEED });
    renderWithQuery(<ZeroResumeScreen runId={id} />);
    const panel = await screen.findByRole(
      'complementary',
      { name: /^Check \d+ things we guessed$/ },
      wait,
    );
    // Download stays out of reach until every guess is checked (V2 §7.9).
    expect(within(panel).queryByRole('button', { name: /Download PDF/ })).not.toBeInTheDocument();
    expect(within(panel).getByRole('img', { name: /^0 of \d+ checked$/ })).toBeInTheDocument();

    // The first guess is a role: its company is a blank that can't stay.
    expect(within(panel).getByRole('heading', { name: 'Is this role right?' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Save answer' }));
    expect(
      within(panel).getByText('Add the real company — a blank can’t stay.'),
    ).toBeInTheDocument();
    await user.type(within(panel).getByRole('textbox', { name: 'Company' }), 'Northwind');
    await user.click(within(panel).getByRole('button', { name: 'Save answer' }));
    // Saving the role checks its dates and its company together.
    await waitFor(
      () =>
        expect(within(panel).getByRole('img', { name: /^[1-9]\d* of \d+ checked$/ })).toBeVisible(),
      wait,
    );
    expect(within(panel).queryByRole('button', { name: /Download PDF/ })).not.toBeInTheDocument();

    // The rest are removed, which resolves them as surely (V2 §7.9).
    for (let i = 0; i < 20; i += 1) {
      const remove = within(panel).queryByRole('button', {
        name: /^(Remove this (role|entry)|I don’t have it)$/,
      });
      if (!remove) break;
      await waitFor(() => expect(remove).toBeEnabled(), wait);
      await user.click(remove);
      await waitFor(() => expect(remove).not.toBeInTheDocument(), wait);
    }
    const done = await screen.findByRole('complementary', { name: 'Your resume is ready' }, wait);
    expect(within(done).getByRole('button', { name: /Download PDF/ })).toBeEnabled();
    expect(within(done).getByRole('link', { name: /Edit resume/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/resumes\/.+\/edit/),
    );
  }, 30000);
});
