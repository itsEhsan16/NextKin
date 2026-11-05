'use client';

import type { Route } from 'next';
import Link from 'next/link';

import type { AdminPermission, AdminQueue, AdminQueueKey } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AdminBadge, type AdminBadgeTone } from '../../ui/AdminBadge';
import { navFor } from '../../shell/adminNav';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';

type QueueTone = Extract<AdminBadgeTone, 'danger' | 'brand' | 'warning' | 'info'>;

/** Each queue's title, glyph, tone and page (Figma 395:752–395:812). */
const QUEUE: Record<
  AdminQueueKey,
  { title: string; icon: AdminIconName; tone: QueueTone; href: string }
> = {
  generationFailures: {
    title: 'Generation failures',
    icon: 'AlertTriangle',
    tone: 'danger',
    href: '/admin/failures',
  },
  kbReview: {
    title: 'Technology KB review',
    icon: 'Database01',
    tone: 'brand',
    // The diffs are decided on the review page (`toreview.md` §171.9), not in the KB table.
    href: '/admin/technologies/review',
  },
  deletionRequests: {
    title: 'Deletion requests',
    icon: 'UserX01',
    tone: 'warning',
    href: '/admin/deletion-requests',
  },
  abuseReports: {
    title: 'Abuse reports',
    icon: 'Flag01',
    tone: 'danger',
    href: '/admin/abuse-reports',
  },
  promptDrafts: { title: 'Prompt drafts', icon: 'Stars02', tone: 'info', href: '/admin/prompts' },
  providerErrors: {
    title: 'Job provider errors',
    icon: 'Globe01',
    tone: 'warning',
    href: '/admin/providers',
  },
};

/** The featured icon's two rings, in the queue's tone at 8% and 16% (Figma 395:753). */
const RINGS: Record<QueueTone, { outer: string; inner: string }> = {
  danger: { outer: 'bg-danger-600/8 text-danger-600', inner: 'bg-danger-600/16' },
  brand: { outer: 'bg-brand-600/8 text-brand-600', inner: 'bg-brand-600/16' },
  warning: { outer: 'bg-warning-600/8 text-warning-600', inner: 'bg-warning-600/16' },
  info: { outer: 'bg-info-600/8 text-info-600', inner: 'bg-info-600/16' },
};

const QUEUE_KEYS = Object.keys(QUEUE) as AdminQueueKey[];

/** The queues whose page the role can open: the sidebar's rows decide (`adminNav.ts`). */
function queuesFor(permissions: readonly AdminPermission[]): AdminQueueKey[] {
  // The Overview's own row (`/admin`) holds every page's path; only a queue's own page counts.
  const pages = navFor(permissions)
    .flatMap((group) => group.items.map((item) => item.href as string))
    .filter((page) => page !== '/admin');
  return QUEUE_KEYS.filter((key) =>
    pages.some((page) => QUEUE[key].href === page || QUEUE[key].href.startsWith(`${page}/`)),
  );
}

export type NeedsAttentionCardProps = {
  queues: AdminQueue[] | undefined;
  /** The signed-in role's permissions; `undefined` while they load. */
  permissions: readonly AdminPermission[] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
};

/**
 * The work waiting on staff (Figma 395:746), oldest-first detail on each line and a count; each
 * row opens its queue. The header totals what is open. Queues with nothing in them drop out. A
 * queue the role can open but the source doesn't report is named as not connected, so the card
 * never says "All clear" about a queue nobody counted.
 */
export function NeedsAttentionCard({
  queues,
  permissions,
  loading,
  error,
  onRetry,
}: NeedsAttentionCardProps) {
  const visible = permissions ? queuesFor(permissions) : [];
  const served = (queues ?? []).filter((queue) => visible.includes(queue.key));
  const missing = visible.filter((key) => !served.some((queue) => queue.key === key));
  const open = served.filter((queue) => queue.count > 0);
  const total = open.reduce((sum, queue) => sum + queue.count, 0);

  return (
    <AdminCard
      icon="AlertTriangle"
      title="Needs attention"
      trailing={total > 0 ? <AdminBadge tone="danger">{total} open</AdminBadge> : undefined}
      bodyClassName="py-1 pl-4 pr-3"
    >
      {loading || !permissions ? (
        <div className="flex flex-col" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-b border-neutral-100 py-3.5 last:border-b-0"
            >
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <StateView
          tone="danger"
          title="Couldn’t load the queues"
          actionLabel="Try again"
          onAction={onRetry}
        />
      ) : (
        <>
          {open.length > 0 ? (
            <ul>
              {open.map((queue) => (
                <QueueRow key={queue.key} queue={queue} />
              ))}
            </ul>
          ) : missing.length === 0 ? (
            <CardEmpty title="All clear" message="Nothing is waiting on staff right now." />
          ) : served.length > 0 ? (
            <CardEmpty title="Nothing open" message="The queues reported here are clear." />
          ) : null}
          {missing.length > 0 && <Unserved keys={missing} divided={open.length > 0} />}
        </>
      )}
    </AdminCard>
  );
}

/** The queues the source doesn't report yet (`toreview.md` §171.4), named rather than hidden. */
function Unserved({ keys, divided }: { keys: AdminQueueKey[]; divided: boolean }) {
  return (
    <div
      className={cn(
        'flex animate-reveal flex-col gap-0.5 py-3.5 text-body-s',
        divided && 'border-t border-neutral-100',
      )}
    >
      <p className="font-semibold text-neutral-700">Not connected yet</p>
      <p className="text-text-tertiary">
        The backend doesn’t count these queues yet: {keys.map((key) => QUEUE[key].title).join(', ')}
        .
      </p>
    </div>
  );
}

function QueueRow({ queue }: { queue: AdminQueue }) {
  const { title, icon, tone, href } = QUEUE[queue.key];
  const { iconRef, hoverProps } = useIconHover();

  return (
    <li className="animate-rise border-b border-neutral-100 last:border-b-0">
      <Link
        href={href as Route}
        {...hoverProps}
        className="group/row -mx-2 flex items-center gap-3 rounded-sm px-2 py-3.5 transition-[background-color,scale] duration-press ease-standard hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-600 active:scale-(--scale-pressed)"
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            RINGS[tone].outer,
          )}
        >
          <span
            className={cn(
              'flex size-[30px] items-center justify-center rounded-full',
              RINGS[tone].inner,
            )}
          >
            <AdminIcon ref={iconRef} name={icon} size="sm" />
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-s">
          <span className="truncate font-semibold text-text-primary">{title}</span>
          <span className="truncate text-text-secondary">{queue.detail}</span>
        </span>
        <AdminBadge tone={tone}>
          {queue.count}
          <span className="sr-only"> open</span>
        </AdminBadge>
        <AdminIcon
          name="ChevronRight"
          size="sm"
          className="text-neutral-400 transition-[translate,color] duration-fast ease-standard group-hover/row:translate-x-0.5 group-hover/row:text-neutral-600"
        />
      </Link>
    </li>
  );
}
