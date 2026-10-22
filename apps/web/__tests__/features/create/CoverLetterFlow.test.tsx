import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockStore, resetMockRepos } from '@nextkin/shared/repos';

import { CoverLetterScreen } from '@/features/create/screens/CoverLetterScreen';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';
import { finishedRun } from '../../../testSupport/runs';

const replace = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/create/cover-letter',
  useSearchParams: () => new URLSearchParams(),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };
const GOOGLE = { kind: 'job', id: 'job_google' } as const;

/** The mock starts with this month's one letter spent; these cases need it back. */
function freeLetter() {
  const { subscription } = mockStore.state;
  mockStore.state.subscription = {
    ...subscription,
    usage: { ...subscription.usage, coverLettersUsed: 0 },
  };
}

/** toreview §126: Home's Cover Letter tile — the job, the resume, the tone, then the letter. */
describe('Cover Letter', () => {
  beforeEach(() => {
    resetMockRepos();
    replace.mockClear();
    push.mockClear();
  });

  it('starts on the job, with the newest saved job picked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<CoverLetterScreen />);
    expect(
      await screen.findByRole('heading', { name: 'Which job is the letter for?' }, wait),
    ).toBeInTheDocument();
    const list = await screen.findByRole('radiogroup', { name: 'Your saved jobs' }, wait);
    expect(within(list).getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(/^\/create\/cover-letter\?job=[^&]+&step=resume$/),
    );
  }, 15000);

  it('offers only the resumes tailored for a saved job', async () => {
    const user = userEvent.setup();
    renderWithQuery(<CoverLetterScreen target={GOOGLE} />);
    expect(
      await screen.findByRole('heading', { name: 'Which resume is the letter built from?' }, wait),
    ).toBeInTheDocument();
    const list = screen.getByRole('radiogroup', { name: 'Your resumes' });
    const rows = within(list).getAllByRole('radio');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAccessibleName(/Software Engineer Resume/);
    expect(rows[0]).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(push).toHaveBeenCalledWith(
      '/create/cover-letter?job=job_google&resumeId=res_swe&step=tone',
    );
  });

  it('points to tailoring when no resume is tailored for the job', async () => {
    mockStore.state.resumes = mockStore.state.resumes.map((r) => ({
      ...r,
      linkedJobId: undefined,
    }));
    renderWithQuery(<CoverLetterScreen target={GOOGLE} />);
    expect(
      await screen.findByRole('heading', { name: 'Tailor a resume for this job first' }, wait),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tailor a resume/ })).toHaveAttribute(
      'href',
      '/jobs/job_google/tailor?step=resume',
    );
  });

  it('offers Pro once this month’s letters are used', async () => {
    renderWithQuery(<CoverLetterScreen target={GOOGLE} resumeId="res_swe" step="tone" />);
    expect(await screen.findByRole('link', { name: 'See Pro plans' }, wait)).toHaveAttribute(
      'href',
      '/upgrade',
    );
    expect(screen.getByText(/You’ve used this month’s 1 cover letter/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Write my cover letter/ })).not.toBeInTheDocument();
  });

  it('builds from the job and the resume, takes a tone, and writes', async () => {
    const user = userEvent.setup();
    freeLetter();
    renderWithQuery(<CoverLetterScreen target={GOOGLE} resumeId="res_swe" step="tone" />);
    expect(
      await screen.findByRole('heading', { name: 'Pick a tone for your letter' }, wait),
    ).toBeInTheDocument();
    expect(screen.getByText('Software Engineer Resume')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Professional/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(screen.getByRole('radio', { name: /^Confident/ }));
    expect(screen.getByRole('radio', { name: /^Confident/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const write = await screen.findByRole('button', { name: /Write my cover letter/ }, wait);
    await user.click(write);
    await waitFor(
      () =>
        expect(replace).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\/create\/cover-letter\?job=job_google&resumeId=res_swe&run=[^&]+$/,
          ),
        ),
      wait,
    );
    const runId = new URLSearchParams(String(replace.mock.calls.at(-1)?.[0]).split('?')[1]).get(
      'run',
    );
    const run = mockStore.state.generations.find((g) => g.id === runId);
    expect(run).toMatchObject({ kind: 'cover_letter', tone: 'confident', jobId: 'job_google' });
  }, 15000);

  it('shows the letter, with Download, Edit and the other tones', async () => {
    const user = userEvent.setup();
    const id = await finishedRun({
      kind: 'cover_letter',
      sourceResumeId: 'res_swe',
      tone: 'professional',
      jobId: 'job_google',
    });
    renderWithQuery(<CoverLetterScreen target={GOOGLE} resumeId="res_swe" runId={id} />);
    expect(
      await screen.findByRole('heading', { name: 'Your letter is ready' }, wait),
    ).toBeInTheDocument();
    const letter = screen.getByRole('region', { name: 'Your cover letter' });
    await waitFor(() => expect(within(letter).getAllByText(/\w/).length).toBeGreaterThan(2), wait);
    expect(screen.getByRole('link', { name: /Edit letter/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/edit$/),
    );

    // The current tone is marked; each of the others can rewrite the letter.
    const tones = screen.getByRole('heading', { name: 'Try another tone' }).closest('aside')!;
    const professional = within(tones).getByText('Professional').closest('li')!;
    expect(within(professional).getByText('Current')).toBeInTheDocument();
    for (const tone of ['Confident', 'Warm', 'Concise']) {
      const row = within(tones).getByText(tone).closest('li')!;
      expect(within(row).getByRole('button', { name: 'Rewrite' })).toBeInTheDocument();
    }

    // The first download asks whether the letter is accurate (V2 §15 risk 2).
    const download = screen.getByRole('button', { name: /Download PDF/ });
    await waitFor(() => expect(download).toBeEnabled(), wait);
    await user.click(download);
    const prompt = await screen.findByRole('dialog', { name: 'Is everything here true?' }, wait);
    await user.click(within(prompt).getByRole('button', { name: 'Not yet' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Is everything here true?' })).toBeNull(),
    );
  }, 15000);
});
