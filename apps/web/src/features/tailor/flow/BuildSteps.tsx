'use client';

import type { BuildComparison, Job } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';

import {
  backButton,
  ColumnHead,
  FlowFooter,
  StepHeading,
  stepCard,
} from '@/features/create/jobFlow/FlowChrome';
import { Capsule } from '@/features/create/jobFlow/FlowRows';
import { NEVER_ADDS_SKILLS } from '@/features/create/createLibrary';
import { Button } from '@/ui/Button';
import { Callout } from '@/ui/Callout';
import { Check, Stars02, iconSize } from '@/ui/lineIcons';
import { NavAiAssistantIllustration, ProfileSkillsIllustration } from '@/ui/illustrations';

import { BuildHeader, BuildImprovements } from './BuildHeader';

/**
 * Build Resume's Enhance (toreview §126; one step since the owner folded step 3 in, §149): the
 * profile in the resume's place. No board draws it; it is W-FLOW 04's layout over mobile BUILD 04b
 * and 04c's content — how much of the job the profile covers, and which missing keywords to add.
 */
export function BuildEnhanceStep({
  job,
  comparison,
  added,
  onAdded,
  allowanceNote,
  spent,
  pending,
  backHref,
  onCreate,
}: {
  job: Job;
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
            step={2}
            of={3}
            title="Choose what to add"
            lede="Tick only the keywords you really have. They go on the resume and on your profile."
          />
        </div>
        <BuildHeader job={job} comparison={comparison} />
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
        <BuildImprovements comparison={comparison} />
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
