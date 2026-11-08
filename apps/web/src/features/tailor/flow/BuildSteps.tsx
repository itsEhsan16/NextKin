'use client';

import type { BuildComparison, Job } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';

import {
  backButton,
  ColumnHead,
  FlowFooter,
  primaryButton,
  StepHeading,
  stepCard,
} from '@/features/create/jobFlow/FlowChrome';
import { Capsule } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { NEVER_ADDS_SKILLS } from '@/features/create/createLibrary';
import { Button } from '@/ui/Button';
import { Callout } from '@/ui/Callout';
import { AlertTriangle, ArrowRight, Check, CheckCircle, Stars02, iconSize } from '@/ui/lineIcons';
import {
  NavAiAssistantIllustration,
  ProfileAccountIllustration,
  ProfileSkillsIllustration,
} from '@/ui/illustrations';
import { ScoreRing } from '@/ui/ScoreRing';

import { Entity, JobLogoTile } from './CompareStep';

/**
 * Build Resume's steps 3 and 4 (toreview §126): the profile in the resume's place. No board draws
 * them; they are W-FLOW 03 and 04's layout over mobile BUILD 04b and 04c's content — how much of the
 * job the profile covers, then which missing keywords to add before the build.
 */
export function BuildCompareStep({
  job,
  comparison,
  backHref,
  onContinue,
}: {
  job: Job;
  comparison: BuildComparison;
  backHref: Route;
  onContinue: () => void;
}) {
  const tone = comparison.score >= 70 ? 'success' : comparison.score >= 40 ? 'warning' : 'danger';
  const missing = comparison.keywords.filter((k) => !k.onResume);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="build-compare" className={stepCard}>
        <div className="flex flex-wrap items-center gap-7 px-8 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="text-micro font-bold uppercase tracking-wider text-text-brand">
              Step 3 of 4
            </p>
            <h1 id="build-compare" className="text-h1 font-bold text-text-primary">
              Your profile against this job
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <Entity
                lead={<JobLogoTile job={job} />}
                label="The job"
                title={job.company ? `${job.title} · ${job.company}` : job.title}
              />
              <span className="text-body-m font-semibold text-neutral-400">vs</span>
              <Entity
                lead={<ProfileAccountIllustration aria-hidden className="h-auto w-8" />}
                label="Built from"
                title="Your profile"
              />
            </div>
          </div>
          <div className="flex items-center gap-5">
            <ScoreRing
              score={comparison.score}
              label="Job match"
              size={112}
              large
              showLabel
              suffix="%"
              sweep
              tone={tone}
            />
            <div className="flex flex-col items-start gap-2">
              <p className="text-title-l font-bold text-text-primary">
                {missing.length === 0
                  ? 'Your profile covers every keyword'
                  : `${missing.length} ${missing.length === 1 ? 'keyword' : 'keywords'} missing`}
              </p>
              <p className="max-w-64 text-body-m text-text-tertiary">
                Of the job’s keywords, how many your profile shows.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 px-8 pb-8 pt-2">
          <h2 className="text-title-l font-bold text-text-primary">What the job asks for</h2>
          <div className="flex flex-wrap gap-2.5">
            {comparison.keywords.map((k) => (
              <span
                key={k.label}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-3.5 text-body-m font-semibold',
                  k.onResume
                    ? 'border-success-50 bg-success-surface text-success-text'
                    : 'border-dashed border-warning-text bg-warning-50 text-warning-text',
                )}
              >
                {k.onResume ? (
                  <CheckCircle aria-hidden className="size-4.5" />
                ) : (
                  <AlertTriangle aria-hidden className="size-4.5" />
                )}
                {k.label}
              </span>
            ))}
          </div>
          <p className="text-body-s font-medium text-text-tertiary">
            Green is on your profile. Amber is missing — you choose next.
          </p>
        </div>
        <div className="flex flex-col gap-3 px-8 pb-8 pt-2">
          <h2 className="text-title-l font-bold text-text-primary">What the build improves</h2>
          <ul className="flex flex-col gap-2.5">
            {comparison.improvements.map((row) => (
              <li
                key={row.key}
                className="flex items-start gap-3 rounded-md bg-neutral-50 px-4 py-3"
              >
                {row.ok ? (
                  <CheckCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-success-600" />
                ) : (
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-text" />
                )}
                <span className="min-w-0">
                  <span className="block text-body-l font-bold text-text-primary">{row.label}</span>
                  <span className="block text-body-m text-text-secondary">{row.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <FlowFooter note="Your profile isn’t changed. Nothing is spent until you create the resume.">
        <Link href={backHref} className={backButton}>
          Back
        </Link>
        <button type="button" onClick={onContinue} className={primaryButton}>
          Continue
          <ArrowRight aria-hidden className="size-4.5" />
        </button>
      </FlowFooter>
    </div>
  );
}

export function BuildEnhanceStep({
  comparison,
  added,
  onAdded,
  allowanceNote,
  spent,
  pending,
  backHref,
  onCreate,
}: {
  comparison: BuildComparison;
  added: readonly string[];
  onAdded: (added: string[]) => void;
  allowanceNote: string;
  spent: boolean;
  pending: boolean;
  backHref: Route;
  onCreate: () => void;
}) {
  const missing = comparison.keywords.filter((k) => !k.onResume);
  const have = comparison.keywords.filter((k) => k.onResume);
  const toggle = (label: string) =>
    onAdded(added.includes(label) ? added.filter((l) => l !== label) : [...added, label]);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="build-enhance" className={stepCard}>
        <div className="px-8 pb-2 pt-8">
          <StepHeading
            id="build-enhance"
            step={4}
            of={4}
            title="Choose what to add"
            lede="Tick only the keywords you really have. They go on the resume and on your profile."
          />
        </div>
        <div className="grid divide-y divide-border-subtle lg:grid-cols-8 lg:divide-x lg:divide-y-0">
          <div className="flex min-w-0 flex-col gap-4 px-8 pb-8 pt-6 lg:col-span-5 lg:pl-8">
            <ColumnHead
              art={<ProfileSkillsIllustration className="h-auto w-11" />}
              title="Every keyword from this job"
              subtitle={`${have.length} of ${comparison.keywords.length} are already on your profile`}
            />
            {missing.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="text-body-l font-bold text-text-primary">
                    Missing from your profile
                  </span>
                  <span className="text-body-s font-medium text-text-tertiary">
                    Tick the ones you have
                  </span>
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {missing.map((k) => (
                    <Capsule
                      key={k.label}
                      label={k.label}
                      state={added.includes(k.label) ? 'on' : 'off'}
                      onToggle={() => toggle(k.label)}
                    />
                  ))}
                </div>
              </div>
            )}
            {have.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <p className="text-body-l font-bold text-text-primary">Already on your profile</p>
                <div className="flex flex-wrap gap-2.5">
                  {have.map((k) => (
                    <Capsule key={k.label} label={k.label} state="have" />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3.5 px-8 pb-8 pt-6 lg:col-span-3 lg:pr-8">
            <ColumnHead
              art={<NavAiAssistantIllustration className="h-auto w-11" />}
              title="What the AI will write"
              subtitle="From your profile, aimed at this job"
            />
            <ul className="flex flex-col gap-0.5 rounded-md bg-neutral-50 p-1.5">
              {comparison.improvements.map((row) => (
                <li key={row.key} className="flex items-start gap-3 rounded-sm px-3.5 py-2.5">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-brand-600 text-text-inverse"
                  >
                    <Check className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-body-l font-semibold text-text-primary">
                      {row.label}
                    </span>
                    <span className="block text-body-s font-medium text-text-tertiary">
                      {row.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Callout>{NEVER_ADDS_SKILLS}</Callout>
          </div>
        </div>
      </section>
      <FlowFooter note={allowanceNote}>
        <Link href={backHref} className={backButton}>
          Back
        </Link>
        <Button
          size="lg"
          onClick={onCreate}
          disabled={spent}
          loading={pending}
          busyLabel="Starting…"
          icon={<Stars02 aria-hidden className={iconSize.sm} />}
        >
          Create my resume
        </Button>
      </FlowFooter>
    </div>
  );
}
