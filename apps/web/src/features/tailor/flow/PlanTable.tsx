'use client';

import type { TailorPlace } from '@nextkin/shared/models';
import type { PlanStep, PlanTarget, ScorePart } from '@nextkin/shared/scoring/fixPlan';
import { Fragment, useState } from 'react';

import { cn } from '@/lib/cn';
import { ChevronDownIcon } from '@/ui/icons';
import { AlertTriangle, Check } from '@/ui/lineIcons';

import { COLS, PlanStepRow, type PlacedBy } from './PlanStepRow';

/** Rubric order, so the bar reads the same for every job. */
const ORDER = ['keywords', 'timeline', 'sections', 'formatting', 'achievements'] as const;
const SHOWN = 6;

/**
 * "Where your points go" (850:228): the 10 points as one bar, each part as wide as its weight and
 * filled to what the resume earns now, what it loses under it, and the biggest loss named.
 */
export function PointsBar({ parts }: { parts: readonly ScorePart[] }) {
  const ordered = ORDER.map((key) => parts.find((p) => p.key === key)).filter(
    (p): p is ScorePart => p !== undefined,
  );
  const worst = [...parts].sort((a, b) => b.lost - a.lost)[0];
  return (
    <div className="flex flex-col gap-3.5 border-t border-border-default px-8 pb-6 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-l font-bold text-text-primary">Where your points go</h2>
        {worst && worst.lost > 0 && (
          <p className="flex items-center gap-1.5 text-body-m font-semibold text-warning-text">
            <AlertTriangle aria-hidden className="size-4.5" />
            Biggest loss: {worst.label}, −{worst.lost.toFixed(1)}
          </p>
        )}
      </div>
      <ul aria-label="Your score by part" className="flex gap-1.5">
        {ordered.map((part) => {
          const filled = part.max > 0 ? Math.min(100, (part.got / part.max) * 100) : 0;
          return (
            <li
              key={part.key}
              className="flex min-w-0 flex-col gap-2"
              style={{ flexGrow: part.max, flexBasis: 0 }}
            >
              <div
                role="img"
                aria-label={`${part.label}: ${part.got.toFixed(1)} of ${part.max.toFixed(1)}`}
                title={part.basis}
                className="h-3 overflow-hidden rounded-full bg-neutral-100"
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-meter ease-decelerate',
                    filled >= 99 ? 'bg-success-600' : 'bg-brand-600',
                  )}
                  style={{ width: `${filled}%` }}
                />
              </div>
              <div className="min-w-0 text-body-m">
                <p className="truncate font-semibold text-neutral-700">{part.label}</p>
                <p className="flex gap-1.5 truncate">
                  <span className="text-text-tertiary">
                    {part.got.toFixed(1)} / {part.max.toFixed(1)}
                  </span>
                  {part.lost > 0 && (
                    <span className="font-semibold text-warning-text">−{part.lost.toFixed(1)}</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-body-s font-medium text-text-tertiary">
        Width is each part’s weight; the fill is what you earn now.
      </p>
    </div>
  );
}

/**
 * "Your fix plan" (850:271): each step that would win points back, in the order the path to 8.5
 * re-scored them (toreview §129) — the AI's own steps first, then yours by what they add. Each says
 * what it adds after the ones above it and the score once it is done, and a line marks where the
 * plan reaches the goal.
 */
export function PlanTable({
  steps,
  target,
  added,
  places,
  placeOf,
  resumeId,
  figureOf,
  onToggle,
  onPlace,
  onFigure,
}: {
  steps: readonly PlanStep[];
  target: PlanTarget | undefined;
  added: readonly string[];
  places: readonly TailorPlace[];
  placeOf: (keyword: string) => { where: string; by?: PlacedBy } | undefined;
  resumeId: string;
  figureOf: (bullet: NonNullable<PlanStep['bullet']>) => string | undefined;
  onToggle: (keyword: string, on: boolean) => void;
  onPlace: (keyword: string, where: string | null, by: PlacedBy) => void;
  onFigure: (bullet: NonNullable<PlanStep['bullet']>, text: string | null) => void;
}) {
  const reachAt = target?.steps ?? null;
  const [all, setAll] = useState(false);
  const shownCount = all ? steps.length : Math.max(SHOWN, reachAt ?? 0);
  const shown = steps.slice(0, shownCount);
  return (
    <div className="flex flex-col gap-3 border-t border-border-default px-8 pb-6 pt-5">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-title-l font-bold text-text-primary">Your fix plan</h2>
        <p className="text-body-m font-medium text-text-tertiary">
          Each step re-scored on top of the ones above it
        </p>
      </div>
      <div
        aria-hidden
        className="hidden px-4 text-caption-m font-semibold tracking-wide text-text-tertiary md:flex"
      >
        <span className={COLS.n}>#</span>
        <span className={COLS.asks}>What the job asks</span>
        <span className={COLS.shows}>What your resume shows</span>
        <span className={COLS.who}>Who does it</span>
        <span className={COLS.worth}>Adds</span>
        <span className={COLS.after}>Score after</span>
        <span className={COLS.act} />
      </div>
      <ol className="flex flex-col gap-3">
        {shown.map((step, i) => (
          <Fragment key={step.id}>
            <PlanStepRow
              step={step}
              index={i}
              added={added}
              places={places}
              where={step.keyword !== undefined ? placeOf(step.keyword)?.where : undefined}
              placedBy={step.keyword !== undefined ? placeOf(step.keyword)?.by : undefined}
              resumeId={resumeId}
              figure={step.bullet ? figureOf(step.bullet) : undefined}
              onToggle={onToggle}
              onPlace={onPlace}
              onFigure={(text) => step.bullet && onFigure(step.bullet, text)}
            />
            {target &&
              reachAt !== null &&
              reachAt > 0 &&
              i === reachAt - 1 &&
              i < shown.length - 1 && (
                <li aria-hidden className="flex items-center gap-3 px-1">
                  <span className="h-px flex-1 bg-success-600" />
                  <span className="flex items-center gap-1.5 text-body-m font-semibold text-success-600">
                    <Check className="size-4" />
                    {target.goal.toFixed(1)} reached here
                  </span>
                  <span className="h-px flex-1 bg-success-600" />
                </li>
              )}
          </Fragment>
        ))}
      </ol>
      {steps.length > shownCount || all ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((v) => !v)}
          className="flex items-center gap-1.5 self-start rounded-sm pl-4 text-body-m font-semibold text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {all ? 'Show the top steps only' : `Show all ${steps.length} steps`}
          <ChevronDownIcon
            aria-hidden
            className={cn(
              'size-3 transition-transform duration-press ease-standard',
              all && 'rotate-180',
            )}
          />
        </button>
      ) : null}
    </div>
  );
}
