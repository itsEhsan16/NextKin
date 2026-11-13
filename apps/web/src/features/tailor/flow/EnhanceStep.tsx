'use client';

import type { Job, Resume, TailorComparison } from '@nextkin/shared/models';
import { projectedScore } from '@nextkin/shared/tailor/customize';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  backButton,
  FlowFooter,
  stepCard,
  StepHeading,
} from '@/features/create/jobFlow/FlowChrome';
import { NEVER_ADDS_SKILLS } from '@/features/create/createLibrary';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { ArrowRight, ShieldTick, iconSize } from '@/ui/lineIcons';

import type { TailorChoices } from '../useTailorRun';
import { EnhanceAside } from './EnhanceAside';
import { EnhanceHeader } from './EnhanceHeader';
import { RaiseScorePanel } from './RaiseScorePanel';

/**
 * "Choose keywords to add", step 2 of the tailor flow (owner's mockup, 2026-11-11; it folds the
 * old Enhance in, toreview §149): the job → the resume, the keywords it lacks to tick, and on the
 * right the score, what the AI rewrites and where the score lands. Everything else the plan asks
 * (roles, real results, header checks, other fixes) sits beside the keywords as categories of
 * one rail (owner, 2026-11-14); it was a folded card under the step.
 */
export function EnhanceStep({
  job,
  comparison,
  resume,
  onChangeResume,
  choices,
  allowanceNote,
  spent,
  pending,
  backHref,
  onCreate,
}: {
  job: Job;
  comparison: TailorComparison;
  resume: Resume | undefined;
  onChangeResume: () => void;
  choices: TailorChoices;
  allowanceNote: ReactNode;
  spent: boolean;
  pending: boolean;
  backHref: Route;
  onCreate: () => void;
}) {
  // The AI's own steps, then what the user has answered at its measured gain (toreview §129).
  const base = comparison.plan?.score;
  const projected = projectedScore(comparison.plan, choices.choices);
  // What the user's own answers add on top of the AI's steps: the score card's estimate (§166).
  const withoutAnswers = projectedScore(comparison.plan, {
    ...choices.choices,
    added: [],
    places: {},
    figures: {},
  });
  const answersGain =
    projected !== undefined && withoutAnswers !== undefined ? projected - withoutAnswers : 0;
  const ticked = choices.added.length;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="enhance-step"
        className={cn(stepCard, '@container flex flex-col gap-6 p-8')}
      >
        <StepHeading
          id="enhance-step"
          step={2}
          of={3}
          title="Choose keywords to add"
          lede="Tick only the keywords you really have. The AI works each one in where your experience backs it, to raise your ATS score."
        />
        <div className="grid gap-6 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="@container/main flex min-w-0 flex-col gap-6">
            <EnhanceHeader job={job} resume={resume} onChangeResume={onChangeResume} />
            <RaiseScorePanel comparison={comparison} choices={choices} />
            <p className="flex items-start gap-2 text-body-s font-medium text-text-tertiary">
              <ShieldTick aria-hidden className="mt-px size-4 shrink-0" />
              {NEVER_ADDS_SKILLS}
            </p>
          </div>
          <EnhanceAside
            job={job}
            comparison={comparison}
            choices={choices}
            answersGain={answersGain}
            base={base}
            projected={projected}
          />
        </div>
      </section>

      <FlowFooter note={allowanceNote} noteIcon={false}>
        <Link href={backHref} className={backButton}>
          Back
        </Link>
        <Button
          size="lg"
          onClick={onCreate}
          variant="inverse"
          disabled={spent || choices.fixes.size === 0}
          loading={pending}
          busyLabel="Starting…"
        >
          {ticked > 0 ? `Add ${ticked} keyword${ticked === 1 ? '' : 's'} & continue` : 'Continue'}
          {!pending && <ArrowRight aria-hidden className={iconSize.sm} />}
        </Button>
      </FlowFooter>
    </div>
  );
}
