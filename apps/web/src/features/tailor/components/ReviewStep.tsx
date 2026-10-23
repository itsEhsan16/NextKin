'use client';

import type { Generation, Job, User } from '@nextkin/shared/models';
import { useResume } from '@nextkin/shared/queries';
import type { Route } from 'next';

import { applyUrl, siteLabel } from '@/features/jobs/jobPageLibrary';
import { DownloadPrompts } from '@/features/resumes/components/DownloadPrompts';
import { useConfirmedDownload } from '@/features/resumes/useConfirmedDownload';
import { cn } from '@/lib/cn';

import { resumeFileName } from '../tailorLibrary';
import { ResumeAssistantPanel } from './ResumeAssistantPanel';
import { ResumePreview } from './ResumePreview';
import { ReviewHeader } from './ReviewHeader';
import { ScoreSummaryCard } from './ScoreSummaryCard';

/**
 * The review is a workspace exactly the window's height from lg up (owner, toreview §122): the
 * window less the top bar (4rem), the page frame's top (1.5rem) and the flow's foot (2rem). Nothing
 * outside it scrolls; inside, the conversation and the page do.
 */
const WORKSPACE = 'lg:h-[calc(100dvh-7.5rem)]';

/**
 * Step 3, done: "Resume review" (toreview §121, from the owner's mockup). The header holds the
 * file and the actions; on the left, the score in words and the AI Resume Assistant — "Try asking",
 * Create cover letter, one box; on the right, the page (Preview / Text view). The resume is already
 * saved to Resumes.
 */
export function ReviewStep({
  job,
  generation,
  user,
  backHref,
}: {
  job: Job;
  generation: Generation;
  user: User | undefined;
  backHref?: Route;
}) {
  const resumeId = generation.resumeId ?? '';
  const resume = useResume(resumeId);
  const download = useConfirmedDownload(resumeId);
  const run = generation.tailor;
  const score = run?.score ?? resume.data?.atsScore;
  const pages = run?.pages ?? resume.data?.pageCount ?? 1;
  const name = user ? `${user.firstName} ${user.lastName}` : '';
  const file = user ? resumeFileName(user.firstName, user.lastName, job.company) : '';
  // A pasted JD has no page to apply on.
  const apply = job.applyUrl || job.sourceUrl || job.companyWebsite ? applyUrl(job) : null;

  return (
    <div className={cn('flex flex-col gap-6', WORKSPACE)}>
      <ReviewHeader
        job={job}
        {...(backHref ? { backHref } : {})}
        resumeId={resumeId}
        file={file}
        pages={pages}
        apply={apply}
        applyLabel={apply ? siteLabel(apply) : ''}
        downloading={download.busy}
        onDownload={() => download.start(file || undefined)}
      />
      {download.blocked && (
        <p role="status" className="text-body-s text-text-secondary">
          {download.blocked}
        </p>
      )}
      <DownloadPrompts download={download} />

      <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 lg:min-h-0">
          <ScoreSummaryCard
            score={score}
            loading={resume.isPending}
            baseline={run?.baselineScore}
            projected={run?.projected}
            match={run?.jobMatch}
          />
          <ResumeAssistantPanel generation={generation} company={job.company} />
        </div>
        <div className="lg:min-h-0">
          <ResumePreview
            resumeId={resumeId}
            name={name}
            pages={pages}
            {...(run?.sourceResumeId ? { baseResumeId: run.sourceResumeId } : {})}
          />
        </div>
      </div>
    </div>
  );
}
