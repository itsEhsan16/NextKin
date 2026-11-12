'use client';

import type { Notification } from '@nextkin/shared/models';
import {
  queryPhase,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useRemoveNotification,
} from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { parseBold } from '@/lib/richText';
import { PageHeader } from '@/navigation/PageHeader';
import { showToast } from '@/lib/toast';
import { buttonClass } from '@/ui/Button';
import { ChevronRightIcon } from '@/ui/icons';
import { Settings01 } from '@/ui/lineIcons';
import { pageFrameInBar } from '@/ui/pageFrame';
import { pressable } from '@/ui/pressable';
import { SkeletonListRow } from '@/ui/SkeletonShapes';
import { StateView } from '@/ui/StateView';
import { textLink } from '@/ui/textLink';

import { webHrefOf } from '../webHref';

export const NOTIFICATIONS_TITLE = 'Notifications';

/**
 * The notification feed on the web (owner, 2026-11-02, toreview §148.1): the rows the phone shows,
 * newest first. Opening one marks it read and goes where it points. Spec-derived from the app's page
 * header, cards and state view; no board draws it.
 */
export function NotificationsScreen() {
  const feed = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const remove = useRemoveNotification();
  const router = useGuardedRouter();
  const status = queryPhase(feed);
  const rows = feed.data ?? [];
  const unread = rows.some((row) => !row.read);

  const open = (row: Notification) => {
    if (!row.read) markRead.mutate(row.id);
    const href = webHrefOf(row.deepLink);
    if (href) router.push(href);
  };

  return (
    <div className={cn(pageFrameInBar, 'pb-12')}>
      <PageHeader
        title={NOTIFICATIONS_TITLE}
        subtitle="What happened on NextKin, newest first."
        aside={
          <div className="flex items-center gap-3">
            {/* Sized buttons, not a bare outline and a body-l link (NT-02). */}
            <Link
              href={'/settings?tab=notifications' as Route}
              className={buttonClass({ variant: 'ghost', size: 'sm' })}
            >
              <Settings01 aria-hidden className="size-4" />
              Preferences
            </Link>
            {unread && (
              <button
                type="button"
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
                onClick={() =>
                  markAll.mutate(undefined, {
                    onError: () =>
                      showToast('We couldn’t mark them read. Try again.', { tone: 'error' }),
                  })
                }
              >
                Mark all read
              </button>
            )}
          </div>
        }
      />

      <div className="mt-6 max-w-3xl">
        {status === 'pending' ? (
          <div aria-label="Loading your notifications" aria-busy className="flex flex-col gap-3">
            {/* Each row traced as its text and time, at the row's height and padding (§196). */}
            {[0, 1, 2].map((key) => (
              <SkeletonListRow key={key} tile={null} trailing className="h-20 p-4" />
            ))}
          </div>
        ) : status === 'error' && rows.length === 0 ? (
          <StateView
            tone="danger"
            title="Couldn't load your notifications"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void feed.refetch()}
          />
        ) : rows.length === 0 ? (
          <StateView
            title="Nothing yet"
            message="Finished resumes, saved jobs closing soon and follow-ups on your applications show up here."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <NotificationRow
                key={row.id}
                row={row}
                onOpen={() => open(row)}
                href={webHrefOf(row.deepLink)}
                onRemove={() =>
                  remove.mutate(row.id, {
                    onError: () =>
                      showToast('We couldn’t remove it. Try again.', { tone: 'error' }),
                  })
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * One notification. Unread says so in shape as well as tint: a dot and a heavier headline
 * (redesign R7a, audit NT-03); the tint eases off once read. A row that goes somewhere is a
 * button with a chevron; one with nowhere to go only marks itself read (NT-07).
 */
function NotificationRow({
  row,
  href,
  onOpen,
  onRemove,
}: {
  row: Notification;
  href: string | null | undefined;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const headline = parseBold(row.body)
    .map((run) => run.text)
    .join('');
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border-subtle p-4 shadow-card transition-colors duration-base ease-standard',
        row.read ? 'bg-surface-card' : 'bg-brand-50',
      )}
    >
      {!row.read && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-brand-600" />}
      <button
        type="button"
        onClick={onOpen}
        disabled={!href && row.read}
        aria-label={`${href ? '' : row.read ? '' : 'Mark as read: '}${headline}${row.read ? '' : ', unread'}`}
        className={cn('min-w-0 flex-1 text-left disabled:cursor-default', pressable)}
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
          <p className="mt-1 text-body-s text-text-secondary">{row.description}</p>
        )}
        <p className="mt-1 text-caption-m text-text-tertiary">
          {formatRelativeTime(row.createdAt)}
        </p>
      </button>
      {href && <ChevronRightIcon aria-hidden className="mt-1 size-4 shrink-0 text-text-tertiary" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove: ${headline}`}
        className={cn(textLink, 'shrink-0 text-body-s')}
      >
        Remove
      </button>
    </li>
  );
}
