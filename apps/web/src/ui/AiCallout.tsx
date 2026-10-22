import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { ChevronRightIcon } from '@/ui/icons';
import { NavAiAssistantIllustration } from '@/ui/illustrations';

export type AiCalloutProps = {
  title: string;
  message: string;
  href: Route;
  /**
   * The leading glyph, the duotone AI Assistant glyph unless a caller's suggestion isn't an AI
   * one: the Documents board's "Use this document in your applications" (286:2294) leaves the slot
   * empty.
   */
  icon?: ReactNode;
  /**
   * The boards' surfaces: Jobs' "Tailor your resume" sits on a brand tint (304:2761),
   * Applications' "Prepare for your interview" on the muted grey with a brand chevron (286:1660),
   * and Account's "Get AI-powered profile suggestions" is a card of its own on the page (307:3819).
   */
  tone?: 'brand' | 'muted' | 'card';
};

/**
 * The AI suggestion that closes a detail card: the duotone AI Assistant glyph the sidebar uses
 * (Jobs 457:613, Applications 457:622, Account 457:467 - the boards hid the older sparkle cluster),
 * a title and a line, and a chevron. It links to an existing destination rather than a
 * job-specific flow, since none exists on web yet.
 */
export function AiCallout({ title, message, href, icon, tone = 'brand' }: AiCalloutProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-4 py-3 transition-opacity duration-press ease-standard hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        tone === 'brand'
          ? 'bg-surface-brand-strong'
          : tone === 'muted'
            ? 'bg-surface-muted'
            : 'border border-border-card bg-surface-card',
      )}
    >
      {icon ?? <NavAiAssistantIllustration className="h-auto w-10 shrink-0" />}
      <div className="flex-1">
        <p className="text-body-l font-semibold text-neutral-800">{title}</p>
        <p className="mt-0.5 text-body-s text-text-tertiary">{message}</p>
      </div>
      <ChevronRightIcon
        className={cn(
          'size-5 shrink-0',
          // Brand on the tinted surfaces (Jobs 304:2769, Applications 286:1669); grey on
          // Account's bordered card (307:3825).
          tone === 'card' ? 'text-text-tertiary' : 'text-brand-600',
        )}
        aria-hidden
      />
    </Link>
  );
}
