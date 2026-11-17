'use client';

import { JD_CLOSED_NOTE, JD_CLOSED_TITLE, jdHasClosed } from '@nextkin/shared/models/jd';
import {
  isConsentRequired,
  jdFailureMessage,
  useExtractJd,
  useSavedJobs,
} from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { Callout } from '@/ui/Callout';
import { ArrowRight } from '@/ui/lineIcons';

import {
  backButton,
  FlowFooter,
  primaryButton,
  StepHeading,
  stepCard,
  stepShell,
  TrustNote,
} from './FlowChrome';
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
  note,
  busyLabel,
  spent = false,
}: {
  flow: JobFlow;
  onPicked: (job: PickedJob) => void;
  /** Where the job comes in this flow: second for the ATS check (863:2). */
  stepNo?: number;
  backHref?: Route;
  /** The footer's own words; else the two reassurances (toreview §150). */
  note?: string;
  /** Held while the caller works on the pick (the ATS check starts its run). */
  busyLabel?: string;
  /** This month's allowance is used: the primary becomes the way to more (CR-19, V2 §13.5). */
  spent?: boolean;
}) {
  const copy = JOB_FLOWS[flow];
  const saved = useSavedJobs();
  const extract = useExtractJd();
  const jobs = saved.data ?? [];
  const [savedId, setSavedId] = useState<string | null>(null);
  const [other, setOther] = useState<OtherJob>(emptyOtherJob);
  const [source, setSource] = useState<'saved' | 'other' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // A posting that was read but has closed (toreview §206): said here, before anything is built.
  const [closedId, setClosedId] = useState<string | null>(null);

  const pickedSaved = savedId ?? jobs[0]?.id ?? null;
  const using = source ?? (saved.data && jobs.length === 0 ? 'other' : 'saved');
  const busy =
    extract.isPending || (extract.isSuccess && closedId == null) || busyLabel !== undefined;
  const failed = extract.isError && !isConsentRequired(extract.error);
  const ready =
    using === 'saved' ? pickedSaved != null : other.file != null || other.text.trim().length > 0;

  const next = () => {
    setProblem(null);
    if (closedId && using === 'other') return onPicked({ kind: 'jd', id: closedId });
    if (using === 'saved') {
      if (pickedSaved) onPicked({ kind: 'job', id: pickedSaved });
      return;
    }
    readOther();
  };
  // Continue reads the new job when it is the chosen source (writing in the box chooses it).
  const readOther = () => {
    setSource('other');
    const read = otherJobInput(other);
    if (!read) return setProblem('Paste the job description or its link, or upload a file.');
    if ('problem' in read) return setProblem(read.problem);
    extract.mutate(read.input, {
      onSuccess: (draft) =>
        jdHasClosed(draft) ? setClosedId(draft.id) : onPicked({ kind: 'jd', id: draft.id }),
    });
  };

  return (
    <div className={stepShell}>
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
        <div className="grid gap-5 px-8 pb-8 pt-4 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
          {/* Both columns stretch to the row, and each panel fills its column (owner, 2026-11-17). */}
          <div className="flex min-w-0 flex-col">
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
          <div className="flex min-w-0 flex-col">
            <OtherJobBox
              value={other}
              selected={using === 'other'}
              busy={extract.isPending}
              problem={
                problem ?? (failed ? (jdFailureMessage(extract.error) ?? READ_FAILED) : null)
              }
              onChange={(value) => {
                setOther(value);
                setSource(value.text || value.file ? 'other' : 'saved');
                setProblem(null);
                setClosedId(null);
                extract.reset();
              }}
            />
            {closedId && using === 'other' && (
              <Callout tone="warning" className="mt-3">
                <span className="font-semibold">{JD_CLOSED_TITLE}.</span> {JD_CLOSED_NOTE}
              </Callout>
            )}
          </div>
        </div>
      </section>

      <FlowFooter note={note ?? <TrustNote />}>
        <Link href={backHref} className={backButton}>
          Back
        </Link>
        {spent ? (
          <Link href={'/upgrade' as Route} className={primaryButton}>
            See Pro plans
          </Link>
        ) : (
          <button type="button" onClick={next} disabled={!ready || busy} className={primaryButton}>
            {busyLabel ??
              (busy
                ? 'Reading the job…'
                : closedId && using === 'other'
                  ? 'Continue anyway'
                  : 'Continue')}
            <ArrowRight aria-hidden className="size-4.5" />
          </button>
        )}
      </FlowFooter>
    </div>
  );
}
