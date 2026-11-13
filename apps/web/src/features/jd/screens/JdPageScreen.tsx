'use client';

import { linesOf } from '@nextkin/shared/jobs/jdSections';
import { UNTITLED_JD } from '@nextkin/shared/models';
import { queryPhase, useJdJob, useProfile, useStall } from '@nextkin/shared/queries';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { AiLoader } from '@/ui/AiLoader';
import { useReveal } from '@/lib/useReveal';
import { Button } from '@/ui/Button';
import { cardSurface } from '@/ui/Card';
import { JdRobotIllustration } from '@/ui/illustrations';
import { RefreshCw01, Stars02, iconSize } from '@/ui/lineIcons';
import { pageFillMin, pageFrame } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AiToolsCard } from '../../jobs/components/page/JobAside';
import { JobPageTop } from '../../jobs/components/page/JobPageTop';
import { Responsibilities } from '../../jobs/components/page/JobSections';
import { JobSummary } from '../../jobs/components/page/JobSummary';
import { JdEditPanel } from '../components/JdEditPanel';
import { JdPlausibilityCallout, JdReadingSections } from '../components/JdReadingSections';
import { JdSkills } from '../components/JdSkills';
import { JdSourceSection } from '../components/JdSourceSection';
import { JdBody } from '../structured/JdBody';
import { JdTop } from '../structured/JdTop';
import { useTailorDialog } from '../../tailor/useTailorDialog';
import { jdTailorHref } from '../jdHref';

/**
 * A job description's own page (toreview §110, §129): what Upload a JD opens once a pasted,
 * uploaded or linked JD is read, shown as a proper job posting. It is the job page (02b, 724:2) for
 * a JD: what the reading found, the match with the profile, anything it asks that nobody could have,
 * responsibilities and qualifications, then the rest of the posting section by section (nice to
 * have, benefits, pay, place, the company, how to apply), the full text, and beside it the AI tools
 * — "Tailor my resume" is also the page's own primary action. Listing-only parts (posted,
 * applicants, Save, similar jobs) are left out.
 *
 * A job read into its structure (toreview §153) is shown from it: the quick facts, anything worth
 * knowing, and each section in its place. NextKin owns that reading (owner, 2026-11-03), so a read
 * job has no "Edit details"; entering the details by hand stays only for a job that couldn't be read.
 */
const STAGE_TEXT = {
  reading: { file: 'Reading the file…', link: 'Reading the page…' },
  understanding: 'Understanding the job…',
  checking: 'Checking what it says…',
} as const;

function stageText(stage: 'reading' | 'understanding' | 'checking' | undefined, source: string) {
  if (stage === 'reading')
    return source === 'link' ? STAGE_TEXT.reading.link : STAGE_TEXT.reading.file;
  return stage ? STAGE_TEXT[stage] : 'Reading the job description…';
}
export function JdPageScreen({ id }: { id: string }) {
  const router = useRouter();
  const editParam = useSearchParams().get('edit') === '1';
  const { draft, view } = useJdJob(id);
  const profile = useProfile();
  const [editing, setEditing] = useState(editParam);
  const reveal = useReveal(view != null, id);
  const tailorDialog = useTailorDialog({ kind: 'jd', id });
  const failed = draft.data?.status === 'failed';
  const reading = draft.data?.status === 'extracting';
  // The draft is fetched again while it is read (useJdDraft); a reading that never lands says so.
  const stall = useStall(reading, id);

  if (queryPhase(draft) === 'error') {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          title="We couldn’t find that job description"
          message="It may have been removed. Paste it again to read it."
          actionLabel="Paste a job description"
          actionHref={'/create/build' as Route}
        />
      </div>
    );
  }

  const stopEditing = () => {
    setEditing(false);
    if (editParam) router.replace(`/jd/${encodeURIComponent(id)}` as Route, { scroll: false });
  };
  const edit = editing || failed;

  // W-FLOW 06 (860:6): the review is its own page, the text beside it (toreview §126).
  if (edit && draft.data && (!reading || stall === 'stalled')) {
    return (
      <div className={cn(pageFrame, 'pb-8')}>
        <JdEditPanel
          key={draft.data.status}
          draft={draft.data}
          onDone={stopEditing}
          backHref={(failed ? '/create/build' : `/jd/${encodeURIComponent(id)}`) as Route}
        />
      </div>
    );
  }

  return (
    <div className={cn(pageFrame, 'pb-8')}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_var(--spacing-aside-rail)]">
        {!view || !draft.data ? (
          <Skeleton className="h-192 rounded-lg" />
        ) : (
          <article
            key={id}
            aria-label={`${view.job.title}${view.job.company ? ` at ${view.job.company}` : ''}`}
            className={cn(cardSurface, 'overflow-hidden', reveal && 'animate-reveal')}
          >
            <JobPageTop
              job={view.job}
              variant="jd"
              backHref={'/create/build' as Route}
              backLabel="Back to Build Resume"
              actions={
                !edit && !reading ? (
                  <Button
                    icon={<Stars02 aria-hidden className={iconSize.sm} />}
                    onClick={tailorDialog.openDialog}
                  >
                    Tailor my resume
                  </Button>
                ) : undefined
              }
            />
            {reading ? (
              <div
                role="status"
                className="flex flex-col items-center gap-3 px-6 py-16 text-center"
              >
                <JdRobotIllustration aria-hidden className="h-auto w-28" />
                {stall === 'stalled' ? (
                  <>
                    <p className="text-body-l font-semibold text-text-primary">
                      We couldn’t finish reading this job description
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        variant="secondary"
                        icon={<RefreshCw01 aria-hidden className={iconSize.sm} />}
                        onClick={() => void draft.refetch()}
                      >
                        Check again
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(true)}>
                        Enter the details
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <AiLoader
                      text={stageText(draft.data.stage, draft.data.source)}
                      className="text-body-l"
                    />
                    <p className="text-body-m text-text-secondary">
                      {stall === 'slow'
                        ? 'Taking longer than usual.'
                        : 'This usually takes a few seconds.'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="animate-reveal">
                {draft.data.title === UNTITLED_JD && (
                  <p
                    role="status"
                    className="mx-8 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-warning-50 px-4 py-3 text-body-s text-warning-text"
                  >
                    The listing doesn’t name the job title.
                  </p>
                )}
                {draft.data.structured ? (
                  <>
                    <JdTop
                      s={draft.data.structured}
                      job={view.job}
                      profile={profile.data}
                      known={view.known}
                    />
                    <JdPlausibilityCallout notes={view.plausibility} />
                    <JdBody s={draft.data.structured} profile={profile.data} />
                  </>
                ) : (
                  <>
                    <JobSummary job={view.job} profile={profile.data} known={view.known} />
                    <JdPlausibilityCallout notes={view.plausibility} />
                    <Responsibilities job={view.job} />
                    <JdSkills
                      draft={draft.data}
                      lines={
                        view.job.requirements.length
                          ? view.job.requirements
                          : linesOf(view.reading, 'requirements')
                      }
                      profile={profile.data}
                    />
                    <JdReadingSections
                      reading={view.reading}
                      withResponsibilities={view.job.responsibilities.length === 0}
                    />
                  </>
                )}
              </div>
            )}
            {/* Open beside the review (V2 §7.5), closed on the page: a fresh section per mode. */}
            <JdSourceSection key={edit ? 'review' : 'page'} text={draft.data.rawText} open={edit} />
          </article>
        )}

        {/* The job page's own column: sticky under the top bar (`stickyBelowTopBar`). */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-21">
          {!view ? (
            <Skeleton className="h-60 rounded-lg" />
          ) : failed ? null : (
            <AiToolsCard
              job={view.job}
              tailorTo={jdTailorHref(id)}
              onTailor={tailorDialog.openDialog}
            />
          )}
        </div>
      </div>
      {tailorDialog.dialog}
    </div>
  );
}
