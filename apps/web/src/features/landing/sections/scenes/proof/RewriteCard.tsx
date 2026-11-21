import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { ClayTile, type ClayScene } from '../../../parts/ClayTile';
import { GlassCard } from '../../../parts/GlassCard';

export type Rewrite = {
  before: string;
  /** The after line; `[[…]]` marks words that come from the job post. */
  after: string;
  role: string;
  /** The role's 3D clay icon. */
  icon: ClayScene;
};

/** Splits the after line into plain runs and job-post highlights (violet on the light glass). */
function renderAfter(text: string): ReactNode[] {
  return text.split(/(\[\[[^\]]+\]\])/).map((part, i) => {
    const hit = /^\[\[(.+)\]\]$/.exec(part);
    if (!hit) return part;
    return (
      <span key={i} data-hl className="font-semibold text-lp-violet">
        {hit[1]}
      </span>
    );
  });
}

/**
 * One rewrite as a dark glass card (Landing v2): the before line, struck through and dimmed; the
 * after line in the job's own words with its job-post words lit; the role at the foot. Rendered in
 * its final state; `sweep` adds the light band ProofBand runs across the card once.
 */
export function RewriteCard({
  item,
  className,
  sweep = false,
}: {
  item: Rewrite;
  className?: string;
  sweep?: boolean;
}) {
  return (
    <GlassCard
      className={cn('shrink-0 rounded-[22px]', className)}
      visualClassName="flex flex-col"
      visual={
        <article
          data-rewrite-card
          data-nav-light
          className="flex h-full flex-col px-6 pt-6 pb-6 sm:px-[30px] sm:pt-7 sm:pb-[26px]"
        >
          {sweep ? (
            <span
              aria-hidden
              data-sweep
              className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-1/3 -translate-x-full opacity-0 bg-[linear-gradient(100deg,transparent,rgba(139,124,255,0.16)_50%,transparent)]"
            />
          ) : null}
          <p className="text-[13px] font-medium tracking-[0.4px] text-lp-on-glass-dim uppercase">
            Before:
          </p>
          <p className="mt-1.5 text-[16px] leading-[26px] sm:text-[17px]">
            <span data-before className="relative text-[#9a9fb2]">
              {item.before}
              <span
                aria-hidden
                data-strike
                className="absolute top-1/2 left-0 h-px w-full origin-left bg-[#9a9fb2]"
              />
            </span>
          </p>
          <p className="mt-[22px] text-[13px] font-medium tracking-[0.4px] text-lp-on-glass-dim uppercase">
            After:
          </p>
          <p
            data-after
            className="mt-1.5 text-[16px] leading-[26px] text-lp-on-glass sm:text-[17px]"
          >
            {renderAfter(item.after)}
          </p>
          <div className="min-h-8 flex-1" />
          <div className="flex items-center gap-3.5 border-t border-lp-glass-line pt-4">
            <span data-role-icon className="shrink-0">
              <ClayTile scene={item.icon} size={44} float={false} shadow={false} />
            </span>
            <span className="text-[15px] font-medium whitespace-nowrap text-lp-on-glass sm:text-[16px]">
              {item.role}
            </span>
          </div>
        </article>
      }
    />
  );
}
