'use client';

import {
  ATS_BAND_LABEL,
  atsBandFor,
  type Job,
  type Resume,
  type TailorComparison,
} from '@nextkin/shared/models';
import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';
import { planGoalLine, projectedScore, shortOnYears } from '@nextkin/shared/tailor/customize';
import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';

import {
  backButton,
  FlowFooter,
  primaryButton,
  stepCard,
} from '@/features/create/jobFlow/FlowChrome';
import { DocTile } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { ArrowRight, ArrowUp } from '@/ui/lineIcons';
import { ScoreRing } from '@/ui/ScoreRing';

import type { TailorChoices } from '../useTailorRun';
import { PlanTable, PointsBar } from './PlanTable';

const RING = { strong: 'success', good: 'success', fair: 'warning', weak: 'danger' } as const;
const PILL = {
  strong: 'bg-success-surface text-success-text',
  good: 'bg-success-surface text-success-text',
  fair: 'bg-warning-50 text-warning-text',
  weak: 'bg-danger-50 text-danger-text',
} as const;

/** "The job · Lead UX Designer · Google" beside "Your resume · …" (850:201). */
export function Entity({ lead, label, title }: { lead: ReactNode; label: string; title: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 rounded-lg bg-neutral-50 py-1.5 pl-2 pr-3.5">
      {lead}
      <span className="min-w-0">
        <span className="block text-micro text-text-tertiary">{label}</span>
        <span className="block truncate text-body-l font-bold text-text-primary">{title}</span>
      </span>
    </span>
  );
}

export function JobLogoTile({ job }: { job: Job }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-faint bg-surface-card">
      <CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} variant="inline" />
    </span>
  );
}

/**
 * W-FLOW 03 (850:2), step 3: your plan to fit this job — the job beside your resume (with Change),
 * the score out of 10 and what the AI can win back now, where the points go, then the fix plan.
 * A keyword ticked here is the same tick as step 4's. Every number is the engine's (`fixPlanOf`):
 * the path to 8.5 (toreview §129) re-scores each step on top of the ones before it, and the
 * projection adds what the user has answered so far.
 */
export function CompareStep({
  job,
  comparison,
  resume,
  onChangeResume,
  choices,
  onToggle,
  allowanceNote,
  backHref,
  onContinue,
}: {
  job: Job;
  comparison: TailorComparison;
  resume: Resume | undefined;
  onChangeResume: () => void;
  choices: TailorChoices;
  onToggle: (keyword: string, on: boolean) => void;
  allowanceNote: string;
  backHref: Route;
  onContinue: () => void;
}) {
  const plan = comparison.plan;
  const steps: readonly PlanStep[] = plan?.steps ?? [];
  const band = atsBandFor(comparison.score);
  const target = plan?.target;
  const projected = projectedScore(plan, choices.choices);
  const short = plan && target && shortOnYears(plan);
  const scored = comparison.scored !== false;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="compare-step" className={stepCard}>
        <div className="flex flex-wrap items-center gap-7 px-8 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="text-micro font-bold uppercase tracking-wider text-text-brand">
              Step 3 of 4
            </p>
            <h1 id="compare-step" className="text-h1 font-bold text-text-primary">
              Your plan to fit this job
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <Entity
                lead={<JobLogoTile job={job} />}
                label="The job"
                title={job.company ? `${job.title} · ${job.company}` : job.title}
              />
              <span className="text-body-m font-semibold text-neutral-400">vs</span>
              <Entity
                lead={<DocTile small />}
                label="Your resume"
                title={resume ? `${resume.title}${resume.isBase ? ' (base)' : ''}` : 'Your resume'}
              />
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={onChangeResume}
                className="h-8 rounded-md border border-border-default bg-surface-card px-3 text-body-m font-semibold text-text-primary transition-colors duration-press ease-standard hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Change
              </button>
            </div>
          </div>
          {scored && (
            <div className="flex items-center gap-5">
              <ScoreRing
                score={comparison.score}
                label="Out of 10"
                name="ATS score"
                size={112}
                outOf10
                large
                showLabel
                sweep
                tone={RING[band]}
              />
              <div className="flex flex-col items-start gap-2">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-caption-m font-semibold',
                    PILL[band],
                  )}
                >
                  ATS score · {ATS_BAND_LABEL[band]}
                </span>
                <p className="text-title-l font-bold text-text-primary">
                  {plan ? planGoalLine(plan) : 'Nothing measured is missing'}
                </p>
                {target && target.ai > plan!.score && (
                  <p className="text-body-m font-medium text-text-secondary">
                    The AI’s own steps take it to {target.ai.toFixed(1)}/10
                  </p>
                )}
                {projected !== undefined && target && projected > target.ai && (
                  <p
                    aria-live="polite"
                    className="flex items-center gap-1.5 text-body-m font-semibold text-success-600"
                  >
                    <ArrowUp aria-hidden className="size-4.5" />
                    With your answers so far: about {projected.toFixed(1)}/10
                  </p>
                )}
                {short && (
                  <p className="max-w-80 text-body-s font-medium text-text-tertiary">
                    Short of {target.goal.toFixed(1)} only because the job asks for more years than
                    your roles show. Nothing honest can add those.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        {plan && <PointsBar parts={plan.parts} />}
        {steps.length > 0 && (
          <PlanTable
            steps={steps}
            target={target}
            added={choices.added}
            places={comparison.places ?? []}
            placeOf={(keyword) => choices.places[keyword]}
            resumeId={comparison.resumeId}
            figureOf={(b) => choices.figureOf(b.roleId, b.index)}
            onToggle={onToggle}
            onPlace={choices.placeKeyword}
            onFigure={(b, text) => choices.setFigure(b.roleId, b.index, text)}
          />
        )}
      </section>

      <FlowFooter note={allowanceNote}>
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
