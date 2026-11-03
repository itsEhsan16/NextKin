'use client';

import type { TailorPlace } from '@nextkin/shared/models';
import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';
import { useState, type ReactNode } from 'react';

import { resumeEditorHref } from '@/features/resumes/resumeHref';
import { cn } from '@/lib/cn';
import { textLink } from '@/ui/textLink';

import type { TailorChoices } from '../useTailorRun';
import { PlacePicker } from './PlacePicker';

const SHOWN = 3;
const linkAction = cn(textLink, 'flex items-center gap-1.5 text-body-m text-text-brand');

/** What a step adds, in the plan's own measure: "+0.3", or why it carries no number. */
function Gain({ step }: { step: PlanStep }) {
  return (
    <span
      className={cn(
        'shrink-0 tabular-nums',
        step.worth !== null
          ? 'text-body-l font-bold text-success-600'
          : 'text-body-s font-medium text-text-tertiary',
      )}
    >
      {step.worth !== null
        ? `+${step.worth.toFixed(1)}`
        : step.who === 'nobody'
          ? ''
          : 'Not scored'}
    </span>
  );
}

function Importance({ step }: { step: PlanStep }) {
  if (!step.importance) return null;
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-caption-m font-semibold',
        step.importance === 'required'
          ? 'bg-danger-50 text-danger-text'
          : 'bg-surface-muted text-text-secondary',
      )}
    >
      {step.importance === 'required' ? 'Required' : 'Preferred'}
    </span>
  );
}

/** A titled group with three rows shown and the rest a link away, as "Add real results" has. */
function Group<T>({
  title,
  hint,
  items,
  row,
}: {
  title: string;
  hint: string;
  items: readonly T[];
  row: (item: T) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-body-l font-bold text-text-primary">{title}</span>
        <span className="text-body-s font-medium text-text-tertiary">{hint}</span>
      </p>
      <ul className="flex flex-col gap-2">{shown.map(row)}</ul>
      {items.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className={cn(linkAction, 'self-start')}
        >
          {all ? 'Show fewer' : `Show ${items.length - SHOWN} more`}
        </button>
      )}
    </div>
  );
}

/**
 * "Show these in a role" (owner, 2026-11-03, toreview §161): skills only in the skills list, which
 * count half until a role or project the user names shows them. Saying where ticks it; Skills only
 * takes it back.
 */
export function ShowInRole({
  steps,
  places,
  choices,
}: {
  steps: readonly PlanStep[];
  places: readonly TailorPlace[];
  choices: TailorChoices;
}) {
  const items = steps.filter(
    (s): s is PlanStep & { keyword: string } =>
      s.kind === 'evidence' && s.who === 'you' && s.keyword !== undefined,
  );
  if (places.length === 0) return null;
  return (
    <Group
      title="Show these in a role"
      hint="Only in your skills list, so they count half"
      items={items}
      row={(step) => {
        const placed = choices.places[step.keyword];
        return (
          <li
            key={step.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-neutral-50 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-body-l font-semibold text-text-primary">{step.keyword}</span>
                <Importance step={step} />
              </p>
              {step.need && (
                <p className="truncate text-body-s font-medium text-text-tertiary">“{step.need}”</p>
              )}
            </div>
            <Gain step={step} />
            <PlacePicker
              places={places}
              where={placed?.where}
              by={placed?.by}
              emptyLabel="Say where you used it"
              onToggle={(where, on) => choices.togglePlace(step.keyword, where, on)}
              onClear={() => choices.setAdded(choices.added.filter((l) => l !== step.keyword))}
            />
          </li>
        );
      }}
    />
  );
}

const WHO = {
  ai: { label: 'AI does it', tone: 'bg-brand-50 text-text-brand' },
  you: { label: 'You fix it', tone: 'bg-warning-50 text-warning-text' },
  nobody: { label: 'Nothing to change', tone: 'bg-surface-muted text-text-secondary' },
} as const;

/** Steps Enhance shows elsewhere: keyword capsules, real results, and the AI's own parts. */
const COVERED = new Set<PlanStep['kind']>(['keyword', 'number', 'headline', 'summary']);

/**
 * "More to raise your score" (owner, 2026-11-03, toreview §161): every other step of the plan —
 * contact details, dates, sections, layout, wording, the years asked — with who does it and what it
 * adds. The ones only the user can fix open the resume in the editor, in a new tab so the flow stays.
 * The headline and summary are left to "What the AI will change", which already lists them.
 */
export function MoreFixes({ steps, resumeId }: { steps: readonly PlanStep[]; resumeId: string }) {
  const items = steps.filter(
    (s) => !COVERED.has(s.kind) && !(s.kind === 'evidence' && s.who === 'you'),
  );
  return (
    <Group
      title="More to raise your score"
      hint="The rest of the plan, with who does each"
      items={items}
      row={(step) => (
        <li
          key={step.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-neutral-50 px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-body-l font-semibold text-text-primary">{step.title}</span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-caption-m font-semibold',
                  WHO[step.who].tone,
                )}
              >
                {WHO[step.who].label}
              </span>
            </p>
            <p className="text-body-s font-medium text-text-tertiary">
              {step.have} · {step.basis}
            </p>
          </div>
          <Gain step={step} />
          {step.who === 'you' && (
            <a
              href={resumeEditorHref(resumeId)}
              target="_blank"
              rel="noreferrer"
              className={linkAction}
            >
              Fix in the editor
            </a>
          )}
        </li>
      )}
    />
  );
}
