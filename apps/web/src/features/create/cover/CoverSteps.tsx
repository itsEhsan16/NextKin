'use client';

import type { CoverLetterTone, Job, Resume } from '@nextkin/shared/models';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { JobLogoTile } from '@/features/tailor/flow/CompareStep';
import { cn } from '@/lib/cn';
import { ArrowRight, Check } from '@/ui/lineIcons';
import { SparkleIllustration } from '@/ui/illustrations';
import { StableLabel } from '@/ui/StableLabel';

import {
  backButton,
  FlowFooter,
  primaryButton,
  StepHeading,
  stepCard,
} from '../jobFlow/FlowChrome';
import { DocTile, Radio, rowSurface } from '../jobFlow/FlowRows';

/** COVER 01's tones (862:225): what each sounds like, in a line, and a sample of it. */
export const TONE_COPY: Record<
  CoverLetterTone,
  { label: string; line: string; sample: (job: Job) => string }
> = {
  professional: {
    label: 'Professional',
    line: 'Clear and polished.',
    sample: (j) =>
      `“I’m writing to apply for the ${j.title} role${j.company ? ` at ${j.company}` : ''}.”`,
  },
  confident: {
    label: 'Confident',
    line: 'Direct and sure of your results.',
    sample: (j) => `“I want to bring my work to ${j.company || 'your team'} as your ${j.title}.”`,
  },
  conversational: {
    label: 'Warm',
    line: 'Friendly and personal.',
    sample: (j) => `“I’d love to help shape what ${j.company || 'your team'} builds next.”`,
  },
  concise: {
    label: 'Concise',
    line: 'Short — three tight paragraphs.',
    sample: () => '“Here’s why my experience fits this role.”',
  },
};
export const TONES = Object.keys(TONE_COPY) as CoverLetterTone[];

function BuiltFromRow({
  lead,
  label,
  title,
  change,
}: {
  lead: React.ReactNode;
  label: string;
  title: string;
  change: Route;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-border-default bg-surface-card py-3 pl-4 pr-3.5">
      {lead}
      <div className="min-w-0 flex-1">
        <p className="text-caption-m text-text-tertiary">{label}</p>
        <p className="truncate text-title-l font-bold text-text-primary">{title}</p>
      </div>
      <Link
        href={change}
        className="flex h-8 items-center rounded-md border border-border-default px-3.5 text-body-m font-semibold text-text-primary hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Change
      </Link>
    </div>
  );
}

/**
 * COVER 01 (862:2), step 3: pick a tone — the letter is built from the job and the resume (each
 * with Change), written in the tone picked, with no new claims (V2 §7.10).
 */
export function CoverToneStep({
  job,
  resume,
  tone,
  onTone,
  changeJob,
  changeResume,
  note,
  noteTone,
  spent,
  pending,
  onWrite,
}: {
  job: Job;
  resume: Resume;
  tone: CoverLetterTone;
  onTone: (tone: CoverLetterTone) => void;
  changeJob: Route;
  changeResume: Route;
  note: string;
  noteTone: 'neutral' | 'danger';
  spent: boolean;
  pending: boolean;
  onWrite: () => void;
}) {
  const company = job.company ? `${job.company}’s` : 'the';
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="cover-tone" className={stepCard}>
        <div className="border-b border-border-default px-8 pb-5 pt-6">
          <StepHeading
            id="cover-tone"
            step={3}
            of={3}
            title="Pick a tone for your letter"
            lede={`We write it from your tailored resume and ${company} job — no new claims.`}
          />
        </div>
        <div className="grid gap-7 px-8 pb-7 pt-6 lg:grid-cols-5">
          <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
            <h2 className="text-body-l font-bold text-text-primary">Built from</h2>
            <BuiltFromRow
              lead={<JobLogoTile job={job} />}
              label="The job"
              title={job.company ? `${job.title} · ${job.company}` : job.title}
              change={changeJob}
            />
            <BuiltFromRow
              lead={<DocTile />}
              label="Your resume"
              title={resume.title}
              change={changeResume}
            />
            <Image
              src="/illustrations/flow/cover-search.png"
              alt=""
              width={360}
              height={240}
              className="mx-auto h-auto w-64 object-contain"
            />
          </div>
          <div
            role="radiogroup"
            aria-labelledby="cover-tones"
            className="flex min-w-0 flex-col gap-3 lg:col-span-3"
          >
            <h2 id="cover-tones" className="text-body-l font-bold text-text-primary">
              Tone
            </h2>
            {TONES.map((t) => {
              const on = t === tone;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onTone(t)}
                  className={cn(
                    rowSurface(on),
                    'flex items-start gap-3.5 px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                  )}
                >
                  <Radio on={on} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="text-title-l font-bold text-text-primary">
                        {TONE_COPY[t].label}
                      </span>
                      <span className="text-body-m font-medium text-text-tertiary">
                        {TONE_COPY[t].line}
                      </span>
                    </span>
                    <span className="mt-1 block text-body-m font-medium text-text-secondary">
                      {TONE_COPY[t].sample(job)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <FlowFooter note={note} noteTone={noteTone}>
        <Link href={changeResume} className={backButton}>
          Back
        </Link>
        {spent ? (
          <Link href={'/upgrade' as Route} className={primaryButton}>
            See Pro plans
          </Link>
        ) : (
          <button type="button" onClick={onWrite} disabled={pending} className={primaryButton}>
            <SparkleIllustration aria-hidden className="h-auto w-4" />
            <StableLabel label="Write my cover letter" busyLabel="Starting…" busy={pending} />
          </button>
        )}
      </FlowFooter>
    </div>
  );
}

const TAILOR_STEPS = [
  'Pick the resume to start from',
  'See how it compares',
  'Choose what to add, then create it',
];

/**
 * COVER 01b (862:254), step 2 when no resume is tailored for this job: a letter repeats what the
 * resume shows for the job, so tailoring comes first — in four short steps — and then back here.
 */
export function CoverTailorFirst({
  job,
  tailorHref,
  backHref,
}: {
  job: Job;
  tailorHref: Route;
  backHref: Route;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="cover-first" className={stepCard}>
        <div className="border-b border-border-default px-8 pb-5 pt-6">
          <StepHeading
            id="cover-first"
            step={2}
            of={3}
            title="Tailor a resume for this job first"
            lede={`A cover letter repeats what your resume shows for this job. You don’t have one tailored${job.company ? ` for ${job.company}` : ''} yet.`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-10 px-8 pb-7 pt-6">
          <Image
            src="/illustrations/flow/build.png"
            alt=""
            width={300}
            height={200}
            className="h-auto w-72 shrink-0 object-contain"
          />
          <div className="flex min-w-0 flex-col gap-3.5">
            <h2 className="text-h2 font-bold text-text-primary">It takes four short steps</h2>
            <ol className="flex flex-col gap-3">
              <li className="flex items-center gap-3 text-body-l text-text-tertiary">
                <span
                  aria-hidden
                  className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-text-inverse"
                >
                  <Check className="size-4" />
                </span>
                Pick the job — done{job.company ? `, it’s ${job.company}’s` : ''}
              </li>
              {TAILOR_STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-body-l text-text-primary">
                  <span
                    aria-hidden
                    className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-micro font-bold text-text-brand"
                  >
                    {i + 2}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-body-m text-text-secondary">
              Then come back here — your letter will use the tailored resume.
            </p>
          </div>
        </div>
      </section>
      <FlowFooter note="Nothing is spent until you create the resume.">
        <Link href={backHref} className={backButton}>
          Back
        </Link>
        <Link href={tailorHref} className={primaryButton}>
          Tailor a resume
          <ArrowRight aria-hidden className="size-4.5" />
        </Link>
      </FlowFooter>
    </div>
  );
}
