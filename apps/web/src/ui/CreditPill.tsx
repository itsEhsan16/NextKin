import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Zap } from '@/ui/lineIcons';

import { InfoTip } from './InfoTip';

/**
 * What an AI action costs, said where it is pressed (redesign R3c; Jobright §1.5.4 "honest about
 * cost at the moment of action", V2 §13). Before: "2 resumes left this month", or "Uses 1
 * generation". After: "1 generation used". Out: "No generations left · Upgrade".
 *
 * Spending is neither good nor bad news, so the pill is neutral grey, never success green. Only
 * the "none left" state takes the paid colour, because its one action is an upgrade.
 */
export type CreditPillProps =
  | { state: 'available' | 'cost' | 'consumed' | 'free'; text: string; rule?: ReactNode }
  | { state: 'none'; text: string; upgradeHref: Route; rule?: ReactNode };

export function CreditPill(props: CreditPillProps) {
  const none = props.state === 'none';
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-caption-m font-semibold',
          none ? 'bg-surface-paid text-text-paid' : 'bg-surface-muted text-text-secondary',
        )}
      >
        <Zap aria-hidden className="size-3 shrink-0" />
        {props.text}
        {props.state === 'none' && (
          <>
            <span aria-hidden>·</span>
            <Link href={props.upgradeHref} className="underline-offset-2 hover:underline">
              Upgrade
            </Link>
          </>
        )}
      </span>
      {props.rule && <InfoTip label="How credits work">{props.rule}</InfoTip>}
    </span>
  );
}
