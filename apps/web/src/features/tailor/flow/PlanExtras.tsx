'use client';

import type { TailorPlace } from '@nextkin/shared/models';
import type { PlanStep } from '@nextkin/shared/scoring/fixPlan';
import { useState, type ReactNode } from 'react';

import { resumeEditorHref } from '@/features/resumes/resumeHref';
import { cn } from '@/lib/cn';
import { ChevronDownIcon } from '@/ui/icons';
import { Check, LinkExternal01 } from '@/ui/lineIcons';
import { textLink } from '@/ui/textLink';

import type { TailorChoices } from '../useTailorRun';
import { PlaceDialog, quoteOf } from './ScoreDialogs';

const linkAction = cn(textLink, 'flex shrink-0 items-center gap-1.5 text-body-m text-text-brand');

/** The skills only in the skills list, which count half until a role shows them (§161). */
export function showInRoleItems(steps: readonly PlanStep[], places: readonly TailorPlace[]) {
  if (places.length === 0) return [];
  return steps.filter(
    (s): s is PlanStep & { keyword: string } =>
      s.kind === 'evidence' && s.who === 'you' && s.keyword !== undefined,
  );
}

/** Steps shown in their own category: keywords, real results, and the AI's own parts. */
const COVERED = new Set<PlanStep['kind']>(['keyword', 'number', 'headline', 'summary']);

/** Every other step of the plan: contact details, dates, sections, layout, wording, years. */
export function moreFixItems(steps: readonly PlanStep[]) {
  return steps.filter((s) => !COVERED.has(s.kind) && !(s.kind === 'evidence' && s.who === 'you'));
}

/**
 * One category's list inside the workspace (owner, 2026-11-14): a header bar with what it is and
 * why it counts, then its rows, in the same frame as the keyword table beside it.
 */
export function CategoryList({
  title,
  hint,
  label,
  children,
}: {
  title: string;
  hint: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-card">
      <div className="flex min-h-control-lg flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border-subtle bg-neutral-50 px-4 py-3">
        <span className="text-body-l font-semibold text-text-primary">{title}</span>
        <span className="text-body-s font-medium text-text-tertiary">{hint}</span>
      </div>
      <ul aria-label={label} className="max-h-112 divide-y divide-border-subtle overflow-y-auto">
        {children}
      </ul>
    </div>
  );
}

export const categoryRow = 'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5';

/** What a step adds, in the plan's own measure: "+0.3", or why it carries no number. */
export function Gain({ step }: { step: PlanStep }) {
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

/** "Used in: Ease Home +1", or the question when nothing is picked yet. */
function placedLabel(places: readonly TailorPlace[], where: readonly string[] | undefined) {
  const chosen = places.filter((p) => where?.includes(p.id));
  if (!chosen.length) return null;
  const [first, ...rest] = chosen;
  return rest.length ? `${first!.label} +${rest.length}` : first!.label;
}

function ShowInRoleRow({
  step,
  places,
  best,
  choices,
}: {
  step: PlanStep & { keyword: string };
  places: readonly TailorPlace[];
  best: readonly string[] | undefined;
  choices: TailorChoices;
}) {
  const [open, setOpen] = useState(false);
  const placed = choices.places[step.keyword];
  const used = placedLabel(places, placed?.where);
  return (
    <li className={categoryRow}>
      <div className="min-w-0 flex-1 basis-60">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-body-l font-semibold text-text-primary">{step.keyword}</span>
          <Importance step={step} />
        </p>
        {step.need && (
          <p className="truncate text-body-s font-medium text-text-tertiary">
            “{quoteOf(step.need)}”
          </p>
        )}
      </div>
      <Gain step={step} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={used ?? undefined}
        className={cn(
          'flex min-w-0 max-w-64 items-center gap-2 rounded-md border bg-surface-card px-3 py-1.5 text-body-m font-semibold transition-colors duration-fast ease-standard hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          used
            ? 'border-border-brand-strong text-brand-700'
            : 'border-border-default text-text-secondary',
        )}
      >
        {used && <Check aria-hidden className="size-4 shrink-0 text-success-600" />}
        <span className="truncate">{used ? `Used in: ${used}` : 'Say where you used it'}</span>
        <ChevronDownIcon aria-hidden className="size-3 shrink-0 -rotate-90 text-text-tertiary" />
      </button>
      <PlaceDialog
        open={open}
        onOpenChange={setOpen}
        keyword={step.keyword}
        need={step.need}
        places={places}
        best={best}
        where={placed?.where}
        onToggle={(where, on) => choices.togglePlace(step.keyword, where, on)}
        onClear={() => choices.setAdded(choices.added.filter((l) => l !== step.keyword))}
      />
    </li>
  );
}

/**
 * "Show these in a role" (owner, 2026-11-03, toreview §161): skills only in the skills list, which
 * count half until a role or project the user names shows them. Where is asked in a dialog (owner,
 * 2026-11-14); saying where ticks it, Skills only takes it back.
 */
export function ShowInRole({
  steps,
  places,
  picks,
  choices,
}: {
  steps: readonly PlanStep[];
  places: readonly TailorPlace[];
  /** The roles whose lines best fit each skill, from the comparison. */
  picks?: Readonly<Record<string, readonly string[]>> | undefined;
  choices: TailorChoices;
}) {
  const items = showInRoleItems(steps, places);
  if (items.length === 0) return null;
  return (
    <CategoryList
      title="Show these in a role"
      hint="Only in your skills list, so they count half"
      label="Skills to show in a role"
    >
      {items.map((step) => (
        <ShowInRoleRow
          key={step.id}
          step={step}
          places={places}
          best={picks?.[step.keyword]}
          choices={choices}
        />
      ))}
    </CategoryList>
  );
}

const WHO = {
  ai: { label: 'AI does it', tone: 'bg-brand-50 text-text-brand' },
  you: { label: 'You fix it', tone: 'bg-warning-50 text-warning-text' },
  nobody: { label: 'Nothing to change', tone: 'bg-surface-muted text-text-secondary' },
} as const;

/**
 * "Other fixes" (owner, 2026-11-03, toreview §161): every other step of the plan with who does it
 * and what it adds. The ones only the user can fix open the resume in the editor, in a new tab so
 * the flow stays.
 */
export function MoreFixes({ steps, resumeId }: { steps: readonly PlanStep[]; resumeId: string }) {
  const items = moreFixItems(steps);
  if (items.length === 0) return null;
  return (
    <CategoryList
      title="Other fixes"
      hint="The rest of the plan, with who does each"
      label="Other fixes"
    >
      {items.map((step) => (
        <li key={step.id} className={categoryRow}>
          <div className="min-w-0 flex-1 basis-60">
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
              <LinkExternal01 aria-hidden className="size-4" />
            </a>
          )}
        </li>
      ))}
    </CategoryList>
  );
}
