import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Generation, Job, TailorRun } from '@nextkin/shared/models';
import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { ReviewStep } from '@/features/tailor/components/ReviewStep';
import { printDocument } from '@/lib/printDocument';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

jest.mock('@/lib/printDocument', () => ({ printDocument: jest.fn() }));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/jobs/job_google/tailor',
  useSearchParams: () => new URLSearchParams(),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };

const run = (patch: Partial<TailorRun> = {}): Generation => ({
  id: 'gen_review',
  kind: 'resume',
  status: 'ready',
  progress: 1,
  startedAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:01:00.000Z',
  resumeId: 'res_pd',
  tailor: {
    sourceResumeId: 'res_pd',
    baselineScore: 53,
    added: ['Figma'],
    skipped: ['Sketch'],
    ...patch,
  },
});

/** W-TAILOR 04 (734:2033): a server run says its own score and what it changed (toreview §110.3). */
describe('the tailored resume, ready', () => {
  let job: Job;
  beforeEach(async () => {
    resetMockRepos();
    jest.mocked(printDocument).mockClear();
    job = await repos.jobs.get('job_google');
  });

  it('is a resume review: the score in words, the assistant, the page (toreview §121)', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <ReviewStep job={job} generation={run({ score: 71, pages: 2 })} user={undefined} />,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Resume review' }, wait),
    ).toBeInTheDocument();
    const score = await screen.findByRole('region', { name: 'Good match' }, wait);
    expect(
      within(score).getByRole('img', { name: 'ATS score: 7.1 out of 10' }),
    ).toBeInTheDocument();
    expect(within(score).getByText(/Up from 5\.3\./)).toBeInTheDocument();
    // Already saved: the pill opens it in Resumes; the main actions sit beside it.
    expect(screen.getByRole('link', { name: 'Saved to Resumes' })).toHaveAttribute(
      'href',
      '/resumes?resume=res_pd',
    );
    expect(screen.getByRole('link', { name: 'Edit resume' })).toHaveAttribute(
      'href',
      '/resumes/res_pd/edit',
    );
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
    const assistant = screen.getByRole('region', { name: 'AI Resume Assistant' });
    expect(within(assistant).getByRole('heading', { name: 'Try asking' })).toBeInTheDocument();
    expect(
      within(assistant).getByRole('button', { name: /Create cover letter/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Text view' })).toBeInTheDocument();
    // The rarer actions sit in the "More actions" menu.
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: /Apply on/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Fit to one page' })).toBeInTheDocument();
  });

  it('says so when the score went down, and offers no apply for a pasted JD', async () => {
    const user = userEvent.setup();
    const pasted: Job = { ...job, applyUrl: undefined, sourceUrl: undefined, companyWebsite: '' };
    renderWithQuery(<ReviewStep job={pasted} generation={run({ score: 49 })} user={undefined} />);
    expect(await screen.findByText(/Down from 5\.3\./, {}, wait)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Open in Resumes' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Apply on/ })).not.toBeInTheDocument();
  });

  it('asks whether the resume is accurate before Download PDF prints it', async () => {
    const user = userEvent.setup();
    renderWithQuery(<ReviewStep job={job} generation={run({ score: 71 })} user={undefined} />);
    const download = await screen.findByRole('button', { name: 'Download PDF' }, wait);
    await waitFor(() => expect(download).toBeEnabled(), wait);

    // V2 §15 risk 2: "Not yet" leaves no file.
    await user.click(download);
    const prompt = await screen.findByRole('dialog', { name: 'Is everything here true?' }, wait);
    await user.click(within(prompt).getByRole('button', { name: 'Not yet' }));
    expect(printDocument).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Is everything here true?' })).toBeNull(),
    );

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    const again = await screen.findByRole('dialog', { name: 'Is everything here true?' }, wait);
    await user.click(within(again).getByRole('button', { name: 'Yes, it’s accurate' }));
    await waitFor(() => expect(printDocument).toHaveBeenCalledTimes(1), wait);
  }, 20000);

  it('sends a question to the assistant with this resume, and an edit to the section rewrite', async () => {
    const user = userEvent.setup();
    const ask = jest.spyOn(repos.assistant, 'send');
    const rewrite = jest.spyOn(repos.resumes, 'rewriteSection');
    renderWithQuery(<ReviewStep job={job} generation={run()} user={undefined} />);
    const assistant = await screen.findByRole('region', { name: 'AI Resume Assistant' }, wait);
    await user.click(within(assistant).getByRole('button', { name: /Why is my ATS score/ }));
    expect(ask).toHaveBeenCalledWith({
      text: 'Why is my ATS score what it is?',
      resumeId: 'res_pd',
    });
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS.normal * 2));
    await user.type(
      within(assistant).getByRole('textbox', { name: 'Ask anything about your resume' }),
      'Shorten my summary{Enter}',
    );
    expect(rewrite).toHaveBeenCalledWith('res_pd', 'summary', 'Shorten my summary');
  }, 20000);

  it('writes a cover letter for the same job from this resume, in the tone picked (toreview §118)', async () => {
    const user = userEvent.setup();
    const start = jest.spyOn(repos.generations, 'start');
    renderWithQuery(
      <ReviewStep
        job={job}
        generation={{ ...run(), jdId: 'jd_1', jobId: 'job_google' }}
        user={undefined}
      />,
    );
    await user.click(await screen.findByRole('button', { name: /Create cover letter/ }, wait));
    const card = await screen.findByRole('region', { name: 'Cover letter for Google' });
    await user.click(within(card).getByRole('radio', { name: 'Concise' }));
    await user.click(within(card).getByRole('button', { name: 'Write my cover letter' }));
    expect(start).toHaveBeenCalledWith({
      kind: 'cover_letter',
      sourceResumeId: 'res_pd',
      tone: 'concise',
      jdId: 'jd_1',
      jobId: 'job_google',
    });
  });
});
