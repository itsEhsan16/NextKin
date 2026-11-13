'use client';

import type { Resume } from '@nextkin/shared/models';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { resumeHref } from '@/features/resumes/resumeHref';
import { cn } from '@/lib/cn';
import { formatUpdated } from '@/lib/format';
import { EyeIcon } from '@/ui/icons';
import { Check as CheckMark, CheckCircle, ChevronRight, File06 } from '@/ui/lineIcons';

/**
 * The W-FLOW boards' shared rows (849:217, 849:524, 849:819, 849:885): a radio, a document row, a
 * choice card with its picture, an "another way" row, and the keyword capsule (852:219).
 */

export function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-surface-card transition-colors duration-press ease-standard',
        on ? 'border-brand-600' : 'border-border-default',
      )}
    >
      {on && <span className="size-2 rounded-full bg-brand-600" />}
    </span>
  );
}

export function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition-colors duration-press ease-standard',
        on
          ? 'border-brand-600 bg-brand-600 text-text-inverse'
          : 'border-border-default bg-surface-card',
      )}
    >
      {on && <CheckMark className="size-4" />}
    </span>
  );
}

/** The brand tile with a document glyph (849:526). */
export function DocTile({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md bg-brand-50 text-text-brand',
        small ? 'size-8' : 'size-10',
      )}
    >
      <File06 className={small ? 'size-4.5' : 'size-4'} />
    </span>
  );
}

/** "3 pages · Updated 2 days ago", "Tailored for Stripe · Updated 5 days ago" (849:533, 849:544). */
export function resumeLine(resume: Resume): string {
  const lead =
    resume.targetCompany && !resume.isBase
      ? `Tailored for ${resume.targetCompany}`
      : resume.pageCount
        ? `${resume.pageCount} ${resume.pageCount === 1 ? 'page' : 'pages'}`
        : undefined;
  return [lead, formatUpdated(resume.updatedAt)].filter(Boolean).join(' · ');
}

export const rowSurface = (on: boolean) =>
  cn(
    'rounded-lg border transition-card duration-base ease-standard',
    on
      ? 'border-brand-600 bg-surface-brand-strong shadow-card ring-1 ring-brand-600'
      : 'border-border-default bg-surface-card hover:-translate-y-0.5 hover:border-border-brand-strong hover:shadow-card-hover',
  );

/** A resume to start from, as a radio row with a way to look at it first (849:524). */
export function ResumeRow({
  resume,
  on,
  onPick,
}: {
  resume: Resume;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <div className={cn(rowSurface(on), 'relative flex items-center gap-3.5 px-4 py-3')}>
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={resume.title}
        onClick={onPick}
        className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />
      <Radio on={on} />
      <DocTile />
      <span className="pointer-events-none min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-title-l font-bold text-text-primary">{resume.title}</span>
          {resume.isBase && (
            <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-caption-m font-semibold text-text-brand">
              Base resume
            </span>
          )}
        </span>
        <span className="block truncate text-body-m text-text-tertiary">{resumeLine(resume)}</span>
      </span>
      <Link
        href={resumeHref(resume.id)}
        target="_blank"
        className="relative flex shrink-0 items-center gap-1.5 rounded-sm text-body-m font-semibold text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <EyeIcon aria-hidden className="size-3.5 text-text-tertiary" />
        Preview
      </Link>
    </div>
  );
}

/** A way to start, as a picture card with a radio (849:819, 849:1309). */
export function OptionCard({
  art,
  title,
  pill,
  on,
  onPick,
  children,
  wide = false,
}: {
  art: string;
  title: string;
  pill?: string;
  on: boolean;
  onPick: () => void;
  children: ReactNode;
  /** The art beside the text, as 02b's single card draws it, instead of above it. */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        // Picture cards stay white when chosen (849:819); only the border says so.
        'relative flex min-w-0 flex-1 gap-5 rounded-lg border bg-surface-card p-6 transition-card duration-base ease-standard',
        on
          ? 'border-brand-600 shadow-card ring-1 ring-brand-600'
          : 'border-border-default hover:-translate-y-0.5 hover:border-border-brand-strong hover:shadow-card-hover',
        wide ? 'items-center' : 'flex-col gap-3',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={title}
        onClick={onPick}
        className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />
      <Image
        src={art}
        alt=""
        width={250}
        height={168}
        className={cn('pointer-events-none h-auto shrink-0 object-contain', wide ? 'w-60' : 'w-56')}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="pointer-events-none flex flex-wrap items-center gap-2.5">
          <Radio on={on} />
          <span className="text-h2 font-bold text-text-primary">{title}</span>
          {pill && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-caption-m font-semibold text-text-brand">
              {pill}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** "Or start another way" (849:885): a picture, two lines and a chevron, as a link. */
export function OtherWayRow({
  art,
  title,
  line,
  href,
  onClick,
}: {
  art: ReactNode;
  title: string;
  line: string;
  href?: Route;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span aria-hidden className="flex w-9 shrink-0 justify-center">
        {art}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-l font-semibold text-text-primary">{title}</span>
        <span className="block truncate text-body-s font-medium text-text-tertiary">{line}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-400" />
    </>
  );
  const className =
    'flex w-full items-center gap-3 rounded-lg border border-border-default bg-surface-card py-3.5 pl-3.5 pr-4 text-left transition-card duration-base ease-standard hover:-translate-y-0.5 hover:border-border-brand-strong hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

/** A keyword capsule (852:219): ticked, open to tick, or already on the resume. */
export function Capsule({
  label,
  state,
  onToggle,
}: {
  label: string;
  state: 'on' | 'off' | 'have';
  onToggle?: () => void;
}) {
  const className = cn(
    'flex items-center gap-2 rounded-full border py-2 pl-4 pr-3.5 text-body-m transition-[background-color,border-color,color] duration-base ease-standard',
    state === 'on' &&
      'border-brand-600 bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-600',
    state === 'off' &&
      'border-border-default bg-surface-card font-medium text-text-secondary hover:border-border-brand-strong hover:bg-surface-brand hover:text-text-primary',
    state === 'have' && 'border-success-50 bg-success-surface font-semibold text-success-text',
  );
  const mark =
    state === 'on' ? (
      <CheckMark aria-hidden className="size-4 text-text-brand" />
    ) : state === 'off' ? (
      <span aria-hidden className="text-body-l leading-none text-neutral-400">
        +
      </span>
    ) : (
      <CheckCircle aria-hidden className="size-4.5 text-success-600" />
    );
  if (state === 'have')
    return (
      <span className={className}>
        {label}
        {mark}
      </span>
    );
  return (
    <button
      type="button"
      aria-pressed={state === 'on'}
      onClick={onToggle}
      className={cn(
        className,
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
      )}
    >
      {label}
      {mark}
    </button>
  );
}
