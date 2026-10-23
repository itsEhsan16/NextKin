'use client';

import { isConsentRequired, useExtractJd, useSavedJobs } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { ArrowRight } from '@/ui/lineIcons';

import { backButton, FlowFooter, primaryButton, StepHeading, stepCard } from './FlowChrome';
import { JOB_FLOWS, type JobFlow, type PickedJob } from './jobFlow';
import { emptyOtherJob, OtherJobBox, otherJobInput, type OtherJob } from './OtherJobBox';
import { SavedJobList } from './SavedJobList';

const READ_FAILED = 'We couldn’t read that job. Check your connection and try again.';

/**
 * W-FLOW 01 (849:3), step 1 of every job-first flow: one card with your saved jobs on the left and
 * a job from anywhere on the right, then the footer bar. The newest saved job starts picked;
 * typing in the other box picks that instead. Nothing is spent here.
 */
export function JobStep({
  flow,
  onPicked,
  stepNo = 1,
  backHref = '/' as Route,
  note = 'Nothing is spent until you create the resume.',
  busyLabel,
}: {
  flow: JobFlow;
  onPicked: (job: PickedJob) => void;
  /** Where the job comes in this flow: second for the ATS check (863:2). */
  stepNo?: number;
  backHref?: Route;
  note?: string;
  /** Held while the caller works on the pick (the ATS check starts its run). */
  busyLabel?: string;
}) {
  const copy = JOB_FLOWS[flow];
  const saved = useSavedJobs();
  const extract = useExtractJd();
  const jobs = saved.data ?? [];
  const [savedId, setSavedId] = useState<string | null>(null);
  const [other, setOther] = useState<OtherJob>(emptyOtherJob);
  const [source, setSource] = useState<'saved' | 'other' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const pickedSaved = savedId ?? jobs[0]?.id ?? null;
  const using = source ?? (saved.data && jobs.length === 0 ? 'other' : 'saved');
  const busy = extract.isPending || extract.isSuccess || busyLabel !== undefined;
  const failed = extract.isError && !isConsentRequired(extract.error);
  const ready =
    using === 'saved' ? pickedSaved != null : other.file != null || other.text.trim().length > 0;

  const next = () => {
    setProblem(null);
    if (using === 'saved') {
      if (pickedSaved) onPicked({ kind: 'job', id: pickedSaved });
      return;
    }
    const read = otherJobInput(other);
    if (!read) return setProblem('Paste the job description or its link, or upload a file.');
    if ('problem' in read) return setProblem(read.problem);
    extract.mutate(read.input, { onSuccess: (draft) => onPicked({ kind: 'jd', id: draft.id }) });
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="job-step" className={stepCard}>
        <div className="px-8 pb-2 pt-8">
          <StepHeading
            id="job-step"
            step={stepNo}
            of={copy.steps.length}
            title={copy.jobTitle}
            lede={copy.jobLede}
          />
        </div>
        <div className="grid divide-y divide-border-subtle lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          <div className="min-w-0 px-8 pb-8 pt-6 lg:col-span-3 lg:pl-8">
            <SavedJobList
              jobs={jobs}
              loading={saved.isPending}
              failed={saved.isError}
              onRetry={() => void saved.refetch()}
              value={using === 'saved' ? pickedSaved : null}
              onChange={(id) => {
                setSavedId(id);
                setSource('saved');
                setProblem(null);
              }}
            />
          </div>
          <div className="flex min-w-0 px-8 pb-8 pt-6 lg:col-span-2 lg:pr-8">
            <OtherJobBox
              value={other}
              selected={using === 'other'}
              busy={extract.isPending}
              problem={problem ?? (failed ? READ_FAILED : null)}
              onChange={(value) => {
                setOther(value);
                setSource(value.text || value.file ? 'other' : 'saved');
                setProblem(null);
                extract.reset();
              }}
            />
          </div>
        </div>
      </section>

      <FlowFooter note={note}>
        <Link href={backHref} className={backButton}>
          Back
        </Link>
        <button type="button" onClick={next} disabled={!ready || busy} className={primaryButton}>
          {busyLabel ?? (busy ? 'Reading the job…' : 'Continue')}
          <ArrowRight aria-hidden className="size-4.5" />
        </button>
      </FlowFooter>
    </div>
  );
}
