'use client';

import type { Notification, NotificationCategory } from '@nextkin/shared/models';
import {
  queryPhase,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useRemoveNotification,
} from '@nextkin/shared/queries';
import * as Radix from '@radix-ui/react-dialog';
import type { Route } from 'next';
import Link from 'next/link';
import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { parseBold } from '@/lib/richText';
import { showToast } from '@/lib/toast';
import { FilterChip } from '@/ui/FilterChip';
import { iconButton } from '@/ui/iconButton';
import { EmptyStateArt } from '@/ui/illustrations';
import {
  ArrowRight,
  Briefcase01,
  Calendar,
  Check,
  File06,
  Settings01,
  Stars02,
  XClose,
  Zap,
} from '@/ui/lineIcons';
import { pressable } from '@/ui/pressable';
import { SkeletonListRow } from '@/ui/SkeletonShapes';
import { textLink } from '@/ui/textLink';

import { webHrefOf } from '../webHref';

type Filter = 'all' | 'unread' | NotificationCategory;

/** Each kind's own tile: a glyph in its tint, so the feed reads at a glance. */
const KIND: Record<
  NotificationCategory,
  { label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }
> = {
  matches: { label: 'Matches', icon: Stars02, tone: 'bg-brand-50 text-text-brand' },
  closing: { label: 'Closing soon', icon: Calendar, tone: 'bg-warning-50 text-warning-text' },
  applications: { label: 'Applications', icon: Briefcase01, tone: 'bg-info-50 text-info-600' },
  ai: { label: 'AI results', icon: Zap, tone: 'bg-success-50 text-success-600' },
  billing: { label: 'Billing', icon: File06, tone: 'bg-surface-muted text-text-secondary' },
};
const ORDER: readonly NotificationCategory[] = [
  'matches',
  'closing',
  'applications',
  'ai',
  'billing',
];

const DAY = 24 * 60 * 60 * 1000;

/** "Today", "Yesterday", "This week", "Earlier": the feed's groups, newest first. */
function groupOf(iso: string, now: Date): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const at = new Date(iso).getTime();
  if (at >= start.getTime()) return 'Today';
  if (at >= start.getTime() - DAY) return 'Yesterday';
  if (at >= start.getTime() - 6 * DAY) return 'This week';
  return 'Earlier';
}

function groups(rows: readonly Notification[], now: Date) {
  const out: { title: string; rows: Notification[] }[] = [];
  for (const row of rows) {
    const title = groupOf(row.createdAt, now);
    const last = out[out.length - 1];
    if (last?.title === title) last.rows.push(row);
    else out.push({ title, rows: [row] });
  }
  return out;
}

const headlineOf = (row: Notification) =>
  parseBold(row.body)
    .map((run) => run.text)
    .join('');

/**
 * The notification window (owner, 2026-11-14: "build our notification window also, but not
 * same"). Jobright opens a wide centred box with an empty inbox column; this drops from the bell
 * as a narrow panel over the page, so the page stays in view. It sorts the feed by kind (Unread,
 * Matches, Closing soon, Applications, AI results, Billing; a kind with none is left out) and by
 * day, gives each row its kind's tile, and does the everyday things in place: open, mark read,
 * remove, mark all read. The full page and the preferences are a click away.
 */
export function NotificationsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const feed = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const remove = useRemoveNotification();
  const router = useGuardedRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const status = queryPhase(feed);
  const rows = feed.data ?? [];
  const unread = rows.filter((r) => !r.read).length;
  const kinds = ORDER.filter((k) => rows.some((r) => r.category === k));
  const shown = rows.filter((r) =>
    filter === 'all' ? true : filter === 'unread' ? !r.read : r.category === filter,
  );
  // A kind that empties (every row removed) falls back to All.
  const active = filter === 'all' || filter === 'unread' || kinds.includes(filter) ? filter : 'all';

  const close = () => onOpenChange(false);
  const go = (row: Notification) => {
    if (!row.read) markRead.mutate(row.id);
    const href = webHrefOf(row.deepLink);
    if (href) {
      close();
      router.push(href);
    }
  };

  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Portal>
        <Radix.Overlay className="fixed inset-0 z-overlay bg-transparent" />
        <Radix.Content
          aria-describedby={undefined}
          className="fixed inset-x-2 top-below-topbar z-modal flex origin-top-right flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-dialog data-[state=closed]:pointer-events-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in sm:left-auto sm:right-6 sm:w-dialog-md"
          style={{ maxHeight: 'calc(100dvh - var(--spacing-below-topbar) - 1rem)' }}
        >
          <header className="flex items-center gap-2 px-5 pb-3 pt-4">
            <Radix.Title className="text-title-l font-bold text-text-primary">
              Notifications
            </Radix.Title>
            {unread > 0 && (
              <span className="whitespace-nowrap rounded-full bg-brand-600 px-2 py-0.5 text-caption-m font-semibold tabular-nums text-text-on-brand">
                {unread} new
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    markAll.mutate(undefined, {
                      onError: () =>
                        showToast('We couldn’t mark them read. Try again.', { tone: 'error' }),
                    })
                  }
                  className={cn(
                    textLink,
                    'mr-1 flex items-center gap-1 whitespace-nowrap text-body-s font-semibold text-text-brand',
                  )}
                >
                  <Check aria-hidden className="size-4" />
                  <span className="max-sm:sr-only">Mark all read</span>
                </button>
              )}
              <Link
                href={'/settings?tab=notifications' as Route}
                onClick={close}
                aria-label="Notification preferences"
                title="Notification preferences"
                className={cn(iconButton, 'text-text-tertiary')}
              >
                <Settings01 aria-hidden className="size-4.5" />
              </Link>
              <Radix.Close aria-label="Close" className={cn(iconButton, 'text-text-tertiary')}>
                <XClose aria-hidden className="size-4.5" />
              </Radix.Close>
            </div>
          </header>

          {rows.length > 0 && (
            <div
              role="group"
              aria-label="Show"
              className="flex gap-2 overflow-x-auto border-b border-border-subtle px-5 pb-3"
            >
              <FilterChip
                label="All"
                active={active === 'all'}
                chevron="none"
                aria-pressed={active === 'all'}
                onClick={() => setFilter('all')}
              />
              <FilterChip
                label={unread > 0 ? `Unread ${unread}` : 'Unread'}
                active={active === 'unread'}
                chevron="none"
                aria-pressed={active === 'unread'}
                onClick={() => setFilter('unread')}
              />
              {kinds.map((k) => (
                <FilterChip
                  key={k}
                  label={KIND[k].label}
                  active={active === k}
                  chevron="none"
                  aria-pressed={active === k}
                  onClick={() => setFilter(k)}
                />
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {status === 'pending' ? (
              <div
                aria-label="Loading your notifications"
                aria-busy
                className="flex flex-col gap-1 p-3"
              >
                {[0, 1, 2].map((key) => (
                  <SkeletonListRow key={key} trailing={false} className="h-16 p-2" />
                ))}
              </div>
            ) : status === 'error' && rows.length === 0 ? (
              <Quiet
                title="We couldn’t load your notifications"
                line="Check your connection and try again."
                action={
                  <button
                    type="button"
                    onClick={() => void feed.refetch()}
                    className={cn(textLink, 'text-body-m text-text-brand')}
                  >
                    Try again
                  </button>
                }
              />
            ) : shown.length === 0 ? (
              <Quiet
                title={
                  rows.length === 0 || active === 'unread' ? 'You’re all caught up' : 'Nothing here'
                }
                line={
                  rows.length === 0
                    ? 'Finished resumes, jobs closing soon and news on your applications land here.'
                    : 'Nothing new since you last looked.'
                }
              />
            ) : (
              groups(shown, new Date()).map((group) => (
                <section key={group.title} aria-label={group.title} className="px-3 pb-2">
                  <h3 className="sticky top-0 z-raised bg-surface-raised px-2 pb-1.5 pt-3 text-caption-m font-semibold uppercase tracking-caps text-text-tertiary">
                    {group.title}
                  </h3>
                  <ul className="flex flex-col gap-0.5">
                    {group.rows.map((row) => (
                      <Row
                        key={row.id}
                        row={row}
                        onOpen={() => go(row)}
                        onRead={() => markRead.mutate(row.id)}
                        onRemove={() =>
                          remove.mutate(row.id, {
                            onError: () =>
                              showToast('We couldn’t remove it. Try again.', { tone: 'error' }),
                          })
                        }
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>

          <footer className="border-t border-border-subtle px-5 py-3">
            <Link
              href={'/notifications' as Route}
              onClick={close}
              className={cn(
                textLink,
                'flex items-center justify-center gap-1.5 text-body-m font-semibold text-text-brand',
              )}
            >
              See all notifications
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </footer>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}

/** The panel's quiet states: a small drawing, one line, and an action when there is one. */
function Quiet({ title, line, action }: { title: string; line: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-10 text-center">
      <EmptyStateArt object="headphones" />
      <p className="text-body-l font-semibold text-text-primary">{title}</p>
      <p className="text-body-s text-text-secondary">{line}</p>
      {action}
    </div>
  );
}

/**
 * One notification: its kind's tile, the headline (bold runs kept), the line under it and when.
 * Unread shows as a dot and a heavier headline. Mark read and Remove appear on hover or focus.
 */
function Row({
  row,
  onOpen,
  onRead,
  onRemove,
}: {
  row: Notification;
  onOpen: () => void;
  onRead: () => void;
  onRemove: () => void;
}) {
  const kind = KIND[row.category];
  const Icon = kind.icon;
  const headline = headlineOf(row);
  const href = webHrefOf(row.deepLink);
  return (
    <li className="group relative flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors duration-fast ease-standard hover:bg-neutral-50 has-focus-visible:bg-neutral-50">
      <span
        aria-hidden
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', kind.tone)}
      >
        {row.visual.kind === 'logo' ? (
          <span className="text-body-l font-bold">
            {row.visual.company.charAt(0).toUpperCase()}
          </span>
        ) : (
          <Icon className="size-5" />
        )}
      </span>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${headline}${row.read ? '' : ', unread'}`}
        className={cn(
          pressable,
          'min-w-0 flex-1 text-left focus-visible:outline-none',
          !href && row.read && 'cursor-default',
        )}
      >
        <p className={cn('text-body-m text-text-primary', !row.read && 'font-semibold')}>
          {parseBold(row.body).map((run, index) =>
            run.bold ? (
              <strong key={index} className="font-semibold">
                {run.text}
              </strong>
            ) : (
              <span key={index}>{run.text}</span>
            ),
          )}
        </p>
        {row.description && (
          <p className="mt-0.5 line-clamp-2 text-body-s text-text-secondary">{row.description}</p>
        )}
        <p className="mt-1 text-caption-m text-text-tertiary">
          {kind.label} · {formatRelativeTime(row.createdAt)}
        </p>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {!row.read && <span aria-hidden className="mt-1.5 size-2 rounded-full bg-brand-600" />}
        <div className="flex items-center opacity-0 transition-opacity duration-fast ease-standard group-hover:opacity-100 group-has-focus-visible:opacity-100 max-sm:opacity-100">
          {!row.read && (
            <button
              type="button"
              onClick={onRead}
              aria-label={`Mark as read: ${headline}`}
              title="Mark as read"
              className={cn(iconButton, 'text-text-tertiary')}
            >
              <Check aria-hidden className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove: ${headline}`}
            title="Remove"
            className={cn(iconButton, 'text-text-tertiary')}
          >
            <XClose aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
