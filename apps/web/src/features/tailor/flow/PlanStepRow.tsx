'use client';

import type { TailorPlace } from '@nextkin/shared/models';
import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';
import { useState, type ComponentType, type SVGProps } from 'react';

import { Check } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { textLink } from '@/ui/textLink';
import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon, LocationPinIcon, PersonIcon, StarIcon } from '@/ui/icons';

import { FigureEditor } from './FigureEditor';
import { PlacePicker, type PlacedBy } from './PlacePicker';

export type { PlacedBy };

export const COLS = {
  n: 'w-11 shrink-0',
  asks: 'flex-11 pr-4',
  shows: 'flex-9 pr-4',
  who: 'flex-6',
  worth: 'flex-3',
  after: 'flex-3',
  act: 'flex-6 flex justify-end',
};

const linkAction = cn(textLink, 'flex items-center gap-1.5 text-body-m');

type Who = { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> | null; tone: string };
function whoOf(step: PlanStep): Who {
  if (step.who === 'ai')
    return { label: 'AI does it', Icon: StarIcon, tone: 'bg-brand-50 text-text-brand' };
  if (step.who === 'nobody')
    return { label: 'Nothing to change', Icon: null, tone: 'bg-surface-muted text-text-secondary' };
  if (step.kind === 'evidence')
    return {
      label: 'Say where you used it',
      Icon: LocationPinIcon,
      tone: 'bg-surface-muted text-neutral-700',
    };
  if (step.kind === 'number')
    return { label: 'Your real figure', Icon: PersonIcon, tone: 'bg-warning-50 text-warning-text' };
  return {
    label: 'Only if you have it',
    Icon: PersonIcon,
    tone: 'bg-warning-50 text-warning-text',
  };
}

/**
 * One step of the plan (850:271, toreview §129): what the job asks, what the resume shows, who
 * does it, what it adds and the score once it is done. A skill step is ticked ("I have this") and
 * placed at a role; a figure step opens the line to write its real result.
 */
export function PlanStepRow({
  step,
  index,
  added,
  places,
  where,
  placedBy,
  resumeId,
  figure,
  onToggle,
  onPlace,
  onFigure,
}: {
  step: PlanStep;
  index: number;
  added: readonly string[];
  places: readonly TailorPlace[];
  where: string | undefined;
  placedBy: PlacedBy | undefined;
  /** The resume being tailored, for "Add the result"'s draft. */
  resumeId: string;
  figure: string | undefined;
  onToggle: (keyword: string, on: boolean) => void;
  onPlace: (keyword: string, where: string | null, by: PlacedBy) => void;
  onFigure: (text: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const who = whoOf(step);
  const on = step.keyword !== undefined && added.includes(step.keyword);
  const done =
    on ||
    (step.kind === 'number' && figure !== undefined) ||
    (step.kind === 'evidence' && where !== undefined);
  const skillStep =
    step.keyword !== undefined && (step.kind === 'keyword' || step.kind === 'evidence');
  const placeable = skillStep && places.length > 0 && on;
  // Ticking takes the AI's pick (toreview §129); without one, the skill goes to Skills only.
  const tick = () => {
    if (on) return onToggle(step.keyword!, false);
    if (step.where) onPlace(step.keyword!, step.where, 'ai');
    else onToggle(step.keyword!, true);
  };
  const pick = (w: string | null) => onPlace(step.keyword!, w, 'you');
  return (
    <li
      className={cn(
        'flex flex-col rounded-lg border',
        done ? 'border-border-brand bg-surface-brand' : 'border-border-default bg-surface-card',
      )}
    >
      <div className="flex flex-wrap items-center gap-y-2 px-4 py-3.5 md:flex-nowrap">
        <span className={cn(COLS.n, 'text-body-l font-bold text-text-tertiary')}>{index + 1}</span>
        <div className={cn(COLS.asks, 'min-w-0')}>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-body-l font-bold text-text-primary">{step.title}</span>
            {step.importance === 'required' && (
              <span className="rounded-full bg-danger-50 px-2.5 py-0.5 text-caption-m font-semibold text-danger-text">
                Required
              </span>
            )}
            {step.importance === 'preferred' && (
              <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-caption-m font-semibold text-text-secondary">
                Preferred
              </span>
            )}
          </p>
          {step.need ? (
            <p className="truncate text-body-m font-medium text-text-secondary">“{step.need}”</p>
          ) : (
            <p className="truncate text-body-s font-medium text-text-tertiary">{step.basis}</p>
          )}
        </div>
        <p
          className={cn(
            COLS.shows,
            'min-w-0 text-body-m font-medium',
            step.kind === 'keyword' ? 'text-warning-text' : 'text-neutral-700',
          )}
        >
          {step.kind === 'number' && figure ? 'Your figure is in' : step.have}
        </p>
        <div className={COLS.who}>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption-m font-semibold',
              who.tone,
            )}
          >
            {who.Icon && <who.Icon aria-hidden className="size-3" />}
            {who.label}
          </span>
        </div>
        <span
          className={cn(
            COLS.worth,
            'tabular-nums',
            step.worth !== null
              ? 'text-title-l font-bold text-success-600'
              : 'text-body-m font-medium text-text-tertiary',
          )}
        >
          {step.worth !== null
            ? `+${step.worth.toFixed(1)}`
            : step.who === 'nobody'
              ? '—'
              : 'Not scored'}
        </span>
        <span
          className={cn(COLS.after, 'text-body-m font-semibold tabular-nums text-text-secondary')}
        >
          {step.totalAfter !== undefined ? step.totalAfter.toFixed(1) : ''}
        </span>
        <div className={COLS.act}>
          {skillStep && (
            <button
              type="button"
              aria-pressed={on}
              onClick={tick}
              className="flex items-center gap-2 rounded-sm text-body-m font-semibold text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Check on={on} />
              {step.kind === 'keyword' ? 'I have this' : 'Show it in a role'}
            </button>
          )}
          {step.kind === 'number' && step.bullet && (
            <button
              type="button"
              aria-expanded={editing}
              onClick={() => setEditing((v) => !v)}
              className={linkAction}
            >
              {figure ? 'Edit your figure' : 'Add the result'}
              <ChevronDownIcon
                aria-hidden
                className={cn(
                  'size-3 transition-transform duration-press ease-standard',
                  editing && 'rotate-180',
                )}
              />
            </button>
          )}
        </div>
      </div>
      {placeable && (
        <div className="flex flex-wrap items-center justify-end gap-2.5 px-4 pb-3.5">
          <span className="text-body-s font-medium text-text-tertiary">
            {where
              ? placedBy === 'ai'
                ? 'Counts in full · the role it fits best, change it if you like'
                : 'Counts in full'
              : 'In your Skills only: counts half'}
          </span>
          <PlacePicker places={places} where={where} by={placedBy} onPlace={pick} />
        </div>
      )}
      {step.kind === 'number' && step.bullet && (
        <CollapseFade axis="vertical" open={editing}>
          <div className="px-4 pb-4">
            <FigureEditor
              open={editing}
              resumeId={resumeId}
              bullet={step.bullet}
              saved={figure}
              onSave={onFigure}
              onDone={() => setEditing(false)}
            />
          </div>
        </CollapseFade>
      )}
    </li>
  );
}
