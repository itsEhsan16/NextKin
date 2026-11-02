'use client';

import type { Job, Profile } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import {
  backButton,
  FlowFooter,
  primaryButton,
  StepHeading,
  stepCard,
  TrustNote,
} from '@/features/create/jobFlow/FlowChrome';
import { ArrowRight, File06, Folder, Stars02 } from '@/ui/lineIcons';

import { MethodCard, Selection } from './MethodCard';
import { MethodDialogs } from './MethodDialogs';
import { METHOD_ORDER, methodLine, type Method } from './methods';

/** What the Enhance step does next, said as it happens (toreview §151). */
const NEXT = [
  'You pick which of the job’s keywords and results to add.',
  'We write a new version. Your original isn’t changed.',
  'You review and edit it, then download it.',
];

/**
 * Step 3 (owner mockup 2026-11-02, toreview §151): how to make the resume — tailor the one picked
 * in step 2, build from the profile, start from nothing with AI, or upload one. Continue opens the
 * chosen way's popup, which says what it does and goes on.
 */
export function MethodStep({
  job,
  resumeTitle,
  profile,
  initial,
  jobHref,
  resumeHref,
  zeroHref,
  onChangeResume,
  onTailor,
  onProfile,
  onUploaded,
}: {
  job: Job;
  resumeTitle: string | undefined;
  profile: Profile | undefined;
  /** Build Resume opens on the profile; tailoring on the picked resume. */
  initial: Method;
  /** "Edit" beside the job and the resume: back to steps 1 and 2. */
  jobHref: Route;
  resumeHref: Route;
  zeroHref: Route;
  onChangeResume: () => void;
  onTailor: () => void;
  onProfile: () => void;
  onUploaded: (resumeId: string) => void;
}) {
  const [method, setMethod] = useState<Method>(initial);
  const [open, setOpen] = useState<Method | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="method-step" className={stepCard}>
        <div className="px-8 pb-2 pt-8">
          <StepHeading
            id="method-step"
            step={3}
            of={4}
            title="How would you like to create your resume?"
            lede={`Choose how to create your resume for the ${job.title} role. You can start from your selected resume, build from your profile, or create a new one.`}
          />
        </div>
        <div className="grid gap-6 px-8 pb-8 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div
            role="radiogroup"
            aria-label="How to create it"
            className="flex min-w-0 flex-col gap-3"
          >
            {METHOD_ORDER.map((m) => (
              <MethodCard
                key={m}
                method={m}
                on={method === m}
                onPick={() => setMethod(m)}
                line={methodLine(m, resumeTitle)}
                recommended={m === 'tailor'}
              />
            ))}
          </div>
          <aside className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-3 rounded-xl border border-border-subtle p-5">
              <h2 className="text-title-l font-bold text-text-primary">Your selections</h2>
              <Selection
                icon={<Folder className="size-5" />}
                label="Job"
                value={job.title}
                href={jobHref}
              />
              <Selection
                icon={<File06 className="size-5" />}
                label="Starting resume"
                value={resumeTitle ?? '—'}
                href={resumeHref}
              />
            </div>
            <div className="flex flex-col gap-3.5 rounded-xl bg-surface-brand p-5">
              <h2 className="flex items-center gap-2 text-title-l font-bold text-text-primary">
                <Stars02 aria-hidden className="size-5 text-text-brand" />
                What happens next?
              </h2>
              <ol className="flex flex-col gap-3">
                {NEXT.map((line, i) => (
                  <li key={line} className="flex items-start gap-3 text-body-m text-text-primary">
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-caption-m font-bold text-text-brand"
                    >
                      {i + 1}
                    </span>
                    <span className="pt-1">{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </section>

      <FlowFooter note={<TrustNote />}>
        <Link href={resumeHref} className={backButton}>
          Back
        </Link>
        <button type="button" onClick={() => setOpen(method)} className={primaryButton}>
          Continue
          <ArrowRight aria-hidden className="size-4.5" />
        </button>
      </FlowFooter>

      <MethodDialogs
        open={open}
        onClose={() => setOpen(null)}
        jobTitle={job.title}
        resumeTitle={resumeTitle}
        profile={profile}
        onChangeResume={() => {
          setOpen(null);
          onChangeResume();
        }}
        onTailor={onTailor}
        onProfile={onProfile}
        zeroHref={zeroHref}
        onUploaded={onUploaded}
      />
    </div>
  );
}
