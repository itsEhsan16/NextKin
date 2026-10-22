import Link from 'next/link';

import { CollapseFade } from '@/ui/CollapseFade';
import { RailTooltip } from '@/ui/RailTooltip';
import { Skeleton } from '@/ui/Skeleton';

export type UserChipProps = {
  name?: string;
  plan: string;
  loading: boolean;
  /** The rail, as React knows it: whether the initials' tooltip is on. The look is `rail:` CSS. */
  collapsed: boolean;
};

/**
 * The signed-in user, above Home in both states.
 *
 * `304:497` draws the full name+plan card; `304:600` (the rail) draws nothing here at all — it
 * jumps straight from the logo to the nav icons. Showing just the initials on request, on the
 * same 40px hit-target column every rail icon shares, so "who am I signed in as" stays visible
 * collapsed too rather than only in the wider state. A deviation from the rail board, logged in
 * `toreview.md`.
 *
 * Two variants, not one resizing element — a card that shows a name and plan, and a single
 * initials chip, aren't the same content redrawn smaller. Cross-fading between two permanent,
 * independently-collapsing blocks is the same pattern `UpgradeCard` uses for the same reason.
 *
 * Both lead to the Account page (307:3443), like the header's avatar. The link names itself, since
 * the rail's initials are hidden from screen readers.
 */
export function UserChip({ name, plan, loading, collapsed }: UserChipProps) {
  const initials = name
    ? name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '';

  return (
    <RailTooltip label={name ?? 'Your profile'} enabled={collapsed}>
      <Link
        href="/profile"
        aria-label={name ? `${name}, your profile` : 'Your profile'}
        className="group mt-3 block w-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <CollapseFade axis="vertical" open="rail">
          {/* Decorative: the initials alone are ambiguous out of context, so this isn't announced
              — a screen-reader user gets the full name from the link's own label. Mouse and
              keyboard users get it from the rail tooltip. */}
          <span
            aria-hidden
            className="mx-auto flex size-8 items-center justify-center rounded-full bg-surface-brand text-caption-m font-semibold text-text-brand"
          >
            {loading ? (
              <Skeleton as="span" className="size-3.5 rounded-full" />
            ) : (
              <span className="transition-opacity duration-fast ease-standard starting:opacity-0">
                {initials}
              </span>
            )}
          </span>
        </CollapseFade>

        <CollapseFade axis="vertical" open="panel">
          {/* The card keeps the expanded panel's width while the sidebar narrows, and the panel
              clips it, so the name doesn't re-truncate frame by frame mid-collapse. */}
          <div className="flex h-11 w-[200px] items-center gap-2.5 rounded-md border border-border-default px-2 transition-colors duration-press ease-standard group-hover:bg-surface-muted">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-brand text-caption-m font-semibold text-text-brand"
            >
              <span className="transition-opacity duration-fast ease-standard starting:opacity-0">
                {initials}
              </span>
            </span>
            <span className="flex min-w-0 flex-col">
              {loading ? (
                <Skeleton as="span" className="my-0.75 h-3.5 w-24" />
              ) : (
                <span className="truncate text-body-l font-semibold text-text-primary">{name}</span>
              )}
              <span className="text-caption-m text-text-tertiary">{plan}</span>
            </span>
          </div>
        </CollapseFade>
      </Link>
    </RailTooltip>
  );
}
