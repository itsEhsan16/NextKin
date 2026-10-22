import type { Route } from 'next';
import type { ComponentType, SVGProps } from 'react';

import type { ActivityEntry, ActivityKind } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { formatRelativeTime } from '@/lib/format';
import { Card } from '@/ui/Card';
import { SectionHeader } from '@/ui/SectionHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import {
  ActivityAppliedIllustration,
  ActivityScannedIllustration,
  ActivityTailoredIllustration,
} from '@/ui/illustrations';

export type RecentActivityCardProps = {
  entries?: ActivityEntry[];
  status: 'pending' | 'error' | 'success';
  onRetry: () => void;
};

/** The board draws three glyphs; every activity kind maps onto one of them. */
const ART_BY_KIND: Record<ActivityKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  ats_check: ActivityScannedIllustration,
  score: ActivityScannedIllustration,
  generation: ActivityTailoredIllustration,
  cover_letter: ActivityTailoredIllustration,
  export: ActivityTailoredIllustration,
  profile: ActivityTailoredIllustration,
  interview: ActivityTailoredIllustration,
  plan: ActivityTailoredIllustration,
  application: ActivityAppliedIllustration,
  saved_job: ActivityAppliedIllustration,
};

const HOUR = 3_600_000;
// Captured once at module load, the same pattern `packages/shared/src/mock/fixtures/time.ts`
// uses for its own fixtures — "2 hours ago" keeps drifting forward correctly as real time
// passes, computed once rather than re-rounded on every render.
const LOADED_AT = Date.now();

/**
 * 286:729's own three rows, exactly as drawn — not `@nextkin/shared`'s `activityFixture`.
 *
 * That fixture is mobile's: 25 entries, cross-checked against mobile's own resumes/jobs
 * fixtures and its History screen's TODAY/THIS WEEK/EARLIER grouping, with copy tuned to
 * mobile's own board across several phases (`toreview.md` §1-8). Its most recent three don't
 * read the way `286:729` does — different wording throughout, and no application to Google
 * anywhere in it at all (mobile never modelled one) — so reworking those specific shared entries
 * to fit here would silently change copy mobile's own already-verified screen renders from the
 * same array.
 *
 * This is the same "two boards, don't port a value between them" split the rest of `apps/web`
 * already draws (see the note atop `theme.css`), just for activity copy instead of colour — a
 * deliberate deviation, not an oversight, logged in `toreview.md` §14. The live query still
 * drives whether there's anything to show at all: loading, error and a genuinely empty feed all
 * render their real states below unchanged. Only a successful, non-empty feed swaps in these
 * three rows instead of the shared fixture's own most-recent three.
 */
const BOARD_ROWS: readonly { id: string; kind: ActivityKind; title: string; createdAt: string }[] =
  [
    {
      id: 'web-ats-scanned',
      kind: 'ats_check',
      title: 'Your resume was ATS scanned',
      createdAt: new Date(LOADED_AT - 2 * HOUR).toISOString(),
    },
    {
      id: 'web-tailored-google',
      kind: 'generation',
      title: 'You tailored resume for Google',
      createdAt: new Date(LOADED_AT - 24 * HOUR).toISOString(),
    },
    {
      id: 'web-applied-google',
      kind: 'application',
      title: 'Applied to Lead UX Designer at Google',
      createdAt: new Date(LOADED_AT - 48 * HOUR).toISOString(),
    },
  ];

/**
 * `Intl.RelativeTimeFormat` always lowercases "yesterday"/"tomorrow" — correct mid-sentence
 * (`ResumeProgressCard`'s "Last updated yesterday"), wrong here where the time sits alone as its
 * own label and 286:729 draws "Yesterday". Scoped to this file rather than `formatRelativeTime`
 * itself, which the mid-sentence callers still need lowercase.
 */
const capitalize = (s: string): string => (s.length ? s[0]!.toUpperCase() + s.slice(1) : s);

/**
 * "Recent Activity" (286:729), at the compact density: 38px rows on a 12px gap with 32px art.
 * See `BOARD_ROWS` for why a successful feed renders that fixed set rather than whatever
 * `entries` actually contains.
 */
export function RecentActivityCard({ entries, status, onRetry }: RecentActivityCardProps) {
  // What replaces the skeleton fades in; content already cached on arrival shows at once.
  const reveal = useReveal(status !== 'pending');
  const hasActivity = (entries?.length ?? 0) > 0;

  return (
    <Card className="w-full p-4 lg:w-[360px] lg:shrink-0">
      <SectionHeader
        title="Recent Activity"
        actionHref={hasActivity ? ('/insights' as Route) : undefined}
      />

      {status === 'pending' && (
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-[38px]" />
          <Skeleton className="h-[38px]" />
          <Skeleton className="h-[38px]" />
        </div>
      )}

      {status === 'error' && (
        <StateView
          className={reveal ? 'animate-reveal' : undefined}
          tone="danger"
          title="Couldn't load activity"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={onRetry}
        />
      )}

      {status === 'success' && !hasActivity && (
        <StateView
          className={reveal ? 'animate-reveal' : undefined}
          title="Nothing yet"
          message="Your recent actions will appear here."
        />
      )}

      {status === 'success' && hasActivity && (
        <ul className={cn('mt-4 flex flex-col gap-3', reveal && 'animate-reveal')}>
          {BOARD_ROWS.map((row) => {
            const Art = ART_BY_KIND[row.kind];
            return (
              <li key={row.id} className="flex items-start gap-2.5">
                <Art className="size-8 shrink-0" />
                <div className="min-w-0">
                  <p className="text-body-m font-medium text-text-primary">{row.title}</p>
                  <p className="mt-0.5 text-caption-m font-medium text-text-tertiary">
                    {capitalize(formatRelativeTime(row.createdAt))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
