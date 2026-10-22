import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { AtsCheckScreen } from '@/features/create/screens/AtsCheckScreen';
import { SAMPLE_JD } from '@/features/upload/uploadLibrary';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';
import { finishedRun } from '../../../testSupport/runs';

const replace = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/create/ats-check',
  useSearchParams: () => new URLSearchParams(),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };

/** toreview §126: Home's ATS Check tile — the resume, then the job, then the score (ATS 01–03). */
describe('ATS Check', () => {
  beforeEach(() => {
    resetMockRepos();
    replace.mockClear();
    push.mockClear();
  });

  it('reads an uploaded resume before it lets you go on to the job', async () => {
    const user = userEvent.setup();
    const view = renderWithQuery(<AtsCheckScreen />);
    expect(
      await screen.findByRole('heading', { name: 'Which resume should we check?' }, wait),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    const file = new File(['resume'], 'Priya_Raman_Resume.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Resume file'), file);
    await waitFor(
      () =>
        expect(replace).toHaveBeenCalledWith(
          expect.stringMatching(/^\/create\/ats-check\?resumeId=[^&]+$/),
        ),
      { timeout: SETTLE_MS.slow * 3 },
    );
    expect(screen.getByText('Priya_Raman_Resume.pdf')).toBeInTheDocument();

    const href = String(replace.mock.calls.at(-1)?.[0]);
    const resumeId = new URLSearchParams(href.split('?')[1]).get('resumeId') ?? '';
    // The read resume is now in the URL; the step reopens on it.
    view.unmount();
    renderWithQuery(<AtsCheckScreen resumeId={resumeId} />);
    const next = screen.getByRole('button', { name: 'Continue' });
    await waitFor(() => expect(next).toBeEnabled(), wait);
    await user.click(next);
    expect(push).toHaveBeenCalledWith(`/create/ats-check?resumeId=${resumeId}&step=job`);
  }, 30000);

  it('checks against the newest saved job by default', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AtsCheckScreen resumeId="res_pd" step="job" />);
    expect(
      await screen.findByRole('heading', { name: 'Which job should we check it against?' }, wait),
    ).toBeInTheDocument();
    const list = await screen.findByRole('radiogroup', { name: 'Your saved jobs' }, wait);
    expect(within(list).getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await waitFor(
      () =>
        expect(replace).toHaveBeenCalledWith(
          expect.stringMatching(/^\/create\/ats-check\?resumeId=res_pd&run=/),
        ),
      wait,
    );
  }, 20000);

  it('checks against a job description pasted from anywhere', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AtsCheckScreen resumeId="res_pd" step="job" />);
    const box = await screen.findByRole('textbox', { name: 'Job description or link' }, wait);
    await user.click(box);
    await user.paste(SAMPLE_JD);
    // Typing in the other box picks it over the saved job.
    const list = await screen.findByRole('radiogroup', { name: 'Your saved jobs' }, wait);
    expect(within(list).queryByRole('radio', { checked: true })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await waitFor(
      () =>
        expect(replace).toHaveBeenCalledWith(
          expect.stringMatching(/^\/create\/ats-check\?resumeId=res_pd&run=/),
        ),
      wait,
    );
  }, 20000);

  it('reads the score, what is missing and the fixes, and offers to fix it for the job', async () => {
    const draft = await repos.jd.extract({ source: 'paste', text: SAMPLE_JD });
    const id = await finishedRun({ kind: 'ats_check', sourceResumeId: 'res_pd', jdId: draft.id });
    renderWithQuery(<AtsCheckScreen resumeId="res_pd" runId={id} />);
    expect(
      await screen.findByRole('heading', { name: /^Your ATS score for / }, wait),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your score' })).toBeInTheDocument();
    expect(screen.getByText('What would raise it')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix it for this job' })).toHaveAttribute(
      'href',
      `/jd/${draft.id}/tailor?resumeId=res_pd&step=compare`,
    );
    expect(screen.getByRole('link', { name: 'Check another' })).toHaveAttribute(
      'href',
      '/create/ats-check',
    );
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/create/ats-check?resumeId=res_pd&step=job',
    );
  });
});
