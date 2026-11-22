import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Generation, Job } from '@nextkin/shared/models';
import { repos, resetMockRepos } from '@nextkin/shared/repos';

import { ReviewStep } from '@/features/tailor/components/ReviewStep';
import { TailorRunView } from '@/features/tailor/components/TailorRunView';
import { renderWithQuery, SETTLE_MS } from '../../../testSupport/render';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/jobs/job_google/tailor',
  useSearchParams: () => new URLSearchParams(),
}));

const wait = { timeout: SETTLE_MS.normal * 4 };
const target = { kind: 'job' as const, id: 'job_google' };

const failed = (patch: Partial<Generation> = {}): Generation => ({
  id: 'gen_failed',
  kind: 'resume',
  status: 'failed',
  progress: 0.5,
  startedAt: '2026-11-22T00:00:00.000Z',
  updatedAt: '2026-11-22T00:01:00.000Z',
  error: 'This took too long and was stopped. Try again.',
  ...patch,
});

/** A run always ends somewhere the user can act on (owner, 2026-11-22). */
describe('a run that did not finish', () => {
  let job: Job;
  beforeEach(async () => {
    resetMockRepos();
    job = await repos.jobs.get('job_google');
  });

  it('says why, and offers Try again on the same run', async () => {
    const retry = jest
      .spyOn(repos.generations, 'retry')
      .mockResolvedValue({ ...failed(), status: 'queued', progress: 0 });
    const user = userEvent.setup();
    renderWithQuery(
      <TailorRunView
        target={target}
        run={failed({
          tailor: { sourceResumeId: 'res_pd', baselineScore: 50, added: [], skipped: [] },
        })}
        job={job}
        resumes={[]}
        user={undefined}
      />,
    );
    expect(screen.getByText(/This took too long and was stopped/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(retry).toHaveBeenCalledWith('gen_failed'));
    expect(screen.getByRole('link', { name: 'Back to my choices' })).toHaveAttribute(
      'href',
      '/jobs/job_google/tailor?resumeId=res_pd&step=enhance',
    );
  });

  it('a failed build run goes back to the build choices', () => {
    renderWithQuery(
      <TailorRunView
        target={target}
        run={failed({ origin: 'build' })}
        job={job}
        resumes={[]}
        user={undefined}
      />,
    );
    expect(screen.getByRole('link', { name: 'Back to my choices' })).toHaveAttribute(
      'href',
      '/jobs/job_google/tailor?step=enhance&mode=build',
    );
  });
});

describe('a finished run with no document', () => {
  it('says so instead of loading for ever', async () => {
    resetMockRepos();
    const job = await repos.jobs.get('job_google');
    renderWithQuery(
      <ReviewStep
        job={job}
        generation={failed({ status: 'ready', progress: 1, error: undefined })}
        user={undefined}
      />,
    );
    expect(
      await screen.findByText('Your resume was made, but we couldn’t open it', undefined, wait),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Resumes' })).toHaveAttribute('href', '/resumes');
  });
});
