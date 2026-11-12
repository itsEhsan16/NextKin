'use client';

import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { cardSurface } from '@/ui/Card';
import { iconButton } from '@/ui/iconButton';
import { ChevronRight, InfoCircle, ShieldTick } from '@/ui/lineIcons';
import { SparkleIllustration } from '@/ui/illustrations';

import { FlowSteps } from '../components/FlowSteps';

/** The two buttons every W-FLOW footer carries (849:313, 849:315). */
export const backButton = buttonClass({ variant: 'secondary', size: 'lg' });
export const primaryButton = buttonClass({ size: 'lg' });

/** The brand tile with the sparkle that leads the header before a job is picked (849:155). */
export function SparkleTile() {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50"
    >
      <SparkleIllustration className="h-auto w-5" />
    </span>
  );
}

/**
 * The flow's header (W-FLOW 849:151): back, what is being made and for what — "Tailor to a job ·
 * Choose the job first", then the job once there is one — and the steps on the right.
 */
export function FlowHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  leading = <SparkleTile />,
  steps,
  step,
}: {
  backHref: Route;
  backLabel: string;
  eyebrow: string;
  title: string;
  leading?: ReactNode;
  steps: readonly string[];
  step: number;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <Link
          href={backHref}
          aria-label={backLabel}
          className={cn(
            iconButton,
            'size-10 rounded-full border border-border-subtle bg-surface-card shadow-card',
          )}
        >
          <ChevronRight aria-hidden className="size-4.5 rotate-180 text-text-primary" />
        </Link>
        {leading}
        <div className="min-w-0">
          <p className="text-caption-m font-medium text-text-tertiary">{eyebrow}</p>
          <p className="truncate text-h2 font-bold tracking-tight text-text-primary">{title}</p>
        </div>
      </div>
      <FlowSteps steps={steps} step={step} />
    </header>
  );
}

/** A step's heading inside its card (849:194): "STEP 1 OF 4", the question, one line under it. */
export function StepHeading({
  step,
  of,
  title,
  lede,
  id,
}: {
  step: number;
  of: number;
  title: string;
  lede: string;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption-m font-semibold uppercase tracking-wide text-text-brand">
        Step {step} of {of}
      </p>
      <h1 id={id} className="text-h1 font-bold tracking-tight text-text-primary">
        {title}
      </h1>
      <p className="max-w-prose text-body-l text-text-secondary">{lede}</p>
    </div>
  );
}

/** A column's head (849:205): its drawing, a title and a line under it, and anything on the right. */
export function ColumnHead({
  art,
  title,
  subtitle,
  aside,
}: {
  art: ReactNode;
  title: string;
  subtitle: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <span aria-hidden className="shrink-0">
        {art}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-title-l font-bold text-text-primary">{title}</h2>
        <p className="mt-0.5 text-body-m text-text-tertiary">{subtitle}</p>
      </div>
      {aside}
    </div>
  );
}

/** A step's card (849:193): the app's card, with the board's soft shadow. */
export const stepCard = cn(cardSurface, 'overflow-hidden rounded-xl');

/**
 * The bar under a step (849:138): what the press costs or needs on the left, Back and the step's
 * one primary action on the right.
 */
export function FlowFooter({
  note,
  noteTone = 'neutral',
  children,
}: {
  note?: ReactNode;
  noteTone?: 'neutral' | 'danger';
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'sticky bottom-4 z-sticky flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border-subtle bg-surface-card/90 px-5 py-3 shadow-popover backdrop-blur-md',
      )}
    >
      <p
        role={noteTone === 'danger' ? 'alert' : undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 text-body-m font-medium',
          noteTone === 'danger' ? 'text-danger-600' : 'text-text-tertiary',
        )}
      >
        {note && <InfoCircle aria-hidden className="size-4.5 shrink-0 text-neutral-400" />}
        {note}
      </p>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

/** A panel inside a step card (W-FLOW 01–02 redesign, toreview §150): bordered, on white. */
export const panel =
  'flex min-w-0 flex-col gap-4 rounded-xl border border-border-subtle bg-surface-card p-5';

/** A panel's head: the round icon tile, its title and line, and an action on the right. */
export function PanelHead({
  icon,
  title,
  subtitle,
  aside,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-text-brand"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-title-l font-bold text-text-primary">{title}</h2>
        <p className="text-body-m text-text-tertiary">{subtitle}</p>
      </div>
      {aside && <div className="shrink-0 pt-1">{aside}</div>}
    </div>
  );
}

/** The footer's two reassurances (toreview §150): nothing is spent yet, and the data stays private. */
export function TrustNote({
  spend = 'Your credits won’t be used until you create a resume.',
}: {
  spend?: string;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="font-semibold text-text-primary">{spend}</span>
      <span aria-hidden className="hidden h-4 w-px bg-border-default sm:block" />
      <span className="flex items-center gap-1.5">
        <ShieldTick aria-hidden className="size-4.5 shrink-0 text-neutral-400" />
        Your data is private and secure.
      </span>
    </span>
  );
}
