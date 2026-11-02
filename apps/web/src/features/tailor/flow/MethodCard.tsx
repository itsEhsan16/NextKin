'use client';

import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Radio } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { Check } from '@/ui/lineIcons';
import { textLink } from '@/ui/textLink';

import { METHOD_ART, METHOD_POINTS, METHOD_TITLE, type Method } from './methods';

/** One way to make the resume, as a radio card: its picture, title, line and points (§151). */
export function MethodCard({
  method,
  on,
  onPick,
  line,
  recommended,
}: {
  method: Method;
  on: boolean;
  onPick: () => void;
  line: string;
  recommended: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex items-center gap-5 rounded-lg border bg-surface-card py-4 pl-5 pr-6 transition-[background-color,border-color,box-shadow,translate] duration-base ease-standard',
        on
          ? 'border-brand-600 shadow-card ring-1 ring-brand-600'
          : 'border-border-default hover:-translate-y-0.5 hover:border-border-brand-strong hover:shadow-card-hover',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={METHOD_TITLE[method]}
        onClick={onPick}
        className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />
      <Radio on={on} />
      <Image
        src={METHOD_ART[method]}
        alt=""
        width={250}
        height={168}
        className="pointer-events-none hidden h-auto w-32 shrink-0 object-contain sm:block"
      />
      <div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-title-l font-bold text-text-primary">{METHOD_TITLE[method]}</span>
          {recommended && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-caption-m font-semibold text-text-brand">
              Recommended
            </span>
          )}
        </div>
        <p className="text-body-m text-text-secondary">{line}</p>
        <ul className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
          {METHOD_POINTS[method].map((point) => (
            <li key={point} className="flex items-center gap-1.5 text-body-s text-text-secondary">
              <Check aria-hidden className="size-3.5 shrink-0 text-text-primary" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** "Your selections": the job or the starting resume, with Edit back to its step. */
export function Selection({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href: Route;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-border-subtle px-4 py-3.5">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-text-brand"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption-m font-medium text-text-tertiary">{label}</p>
        <p className="text-body-l font-bold text-text-primary">{value}</p>
      </div>
      <Link
        href={href}
        aria-label={`Edit ${label.toLowerCase()}`}
        className={cn(textLink, 'text-body-m')}
      >
        Edit
      </Link>
    </div>
  );
}
