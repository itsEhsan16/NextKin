'use client';

import { queryPhase, useJob, useProfile } from '@nextkin/shared/queries';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { cardSurface } from '@/ui/Card';
import { pageFillMin, pageFrame } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AiToolsCard, SimilarJobsCard } from '../components/page/JobAside';
import { JobPageTop, type JobPageTab } from '../components/page/JobPageTop';
import {
  Benefits,
  CompanySection,
  Qualifications,
  Responsibilities,
} from '../components/page/JobSections';
import { JobSummary } from '../components/page/JobSummary';
import { useSaveJob } from '../hooks/useSaveJob';
import { useTailorDialog } from '../../tailor/useTailorDialog';

/**
 * A job's own page (724:2), which the Jobs list's detail card opens in full: the listing in one
 * card — summary and match, responsibilities, qualifications against the profile, benefits and
 * the company — and beside it the AI tools for this job and similar ones. The Company tab shows
 * the company alone.
 */
export function JobPageScreen({ id }: { id: string }) {
  const job = useJob(id, { seedFromLists: true });
  const profile = useProfile();
  const save = useSaveJob();
  const [tab, setTab] = useState<JobPageTab>('overview');
  const reveal = useReveal(job.data != null, id);
  const switched = useReveal(true, tab);
  const tailorDialog = useTailorDialog({ kind: 'job', id });

  if (queryPhase(job) === 'error') {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          title="We couldn't find that job"
          message="It may have closed, or the link may be old. Your other matches are on the Jobs page."
          actionLabel="Back to Jobs"
          actionHref="/jobs"
        />
      </div>
    );
  }

  return (
    <div className={cn(pageFrame, 'pb-8')}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {!job.data ? (
          <Skeleton className="h-[60rem] rounded-lg" />
        ) : (
          <article
            key={id}
            aria-label={`${job.data.title} at ${job.data.company}`}
            className={cn(cardSurface, 'overflow-hidden', reveal && 'animate-rise')}
          >
            <JobPageTop
              job={job.data}
              tab={tab}
              onTab={setTab}
              onToggleSave={() => save.toggle(job.data!)}
              savePending={save.isPending}
            />
            <div key={tab} className={cn('pb-4', switched && 'animate-reveal')}>
              {tab === 'overview' ? (
                <>
                  <JobSummary job={job.data} profile={profile.data} />
                  <Responsibilities job={job.data} />
                  <Qualifications job={job.data} profile={profile.data} />
                  <Benefits job={job.data} />
                  <CompanySection job={job.data} />
                </>
              ) : (
                <CompanySection job={job.data} />
              )}
            </div>
          </article>
        )}

        <div className="flex flex-col gap-6 lg:sticky lg:top-[5.25rem]">
          {job.data ? (
            <>
              <AiToolsCard job={job.data} onTailor={tailorDialog.openDialog} />
              <SimilarJobsCard job={job.data} />
            </>
          ) : (
            <>
              <Skeleton className="h-60 rounded-lg" />
              <Skeleton className="h-52 rounded-lg" />
            </>
          )}
        </div>
      </div>
      {tailorDialog.dialog}
    </div>
  );
}
