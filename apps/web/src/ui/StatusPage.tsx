import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { ChevronRightIcon, HelpIcon } from './icons';
import { iconButton } from './iconButton';
import { pageFillMin } from './pageFrame';

/**
 * A page that stands in for one (SYS 06–08, 871:718/922/1125): the page's name beside a way
 * back, then centred art, an optional pill, the heading, one line, the action and the way to
 * Help & support.
 */
export function StatusPage({
  name,
  backHref = '/' as Route,
  art,
  pill,
  heading,
  message,
  action,
  alert = false,
}: {
  /** The header's title: "Not found", "Interview Prep". */
  name: string;
  backHref?: Route;
  art?: ReactNode;
  pill?: ReactNode;
  heading: string;
  message: string;
  action?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className={cn(pageFillMin, 'flex flex-col gap-6 pb-10')}>
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          aria-label="Back"
          className={cn(
            iconButton,
            'size-9 rounded-full border border-border-default bg-surface-card text-text-primary',
          )}
        >
          <ChevronRightIcon aria-hidden className="size-3.5 rotate-180" />
        </Link>
        <h1 className="text-h2 font-bold text-text-primary">{name}</h1>
      </div>
      <div
        role={alert ? 'alert' : undefined}
        className="mx-auto flex max-w-xl flex-1 animate-reveal flex-col items-center justify-center gap-3.5 pb-16 text-center"
      >
        {art && <div aria-hidden>{art}</div>}
        {pill}
        <h2 className="text-h1 font-bold text-text-primary">{heading}</h2>
        <p className="text-title-l font-medium text-text-secondary">{message}</p>
        {action}
        <p className="flex items-center gap-1.5 text-body-m font-medium text-text-tertiary">
          <HelpIcon aria-hidden className="size-3.5" />
          Still stuck?
          <Link
            href={'/help' as Route}
            className="rounded-sm font-semibold text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Help &amp; support
          </Link>
        </p>
      </div>
    </div>
  );
}
