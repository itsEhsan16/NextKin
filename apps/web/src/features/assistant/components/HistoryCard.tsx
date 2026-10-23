'use client';

import type { AssistantThreadSummary } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { formatHistoryDate } from '@/lib/format';
import { FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { iconButton } from '@/ui/iconButton';
import { MoreHorizontalIcon, PlusIcon } from '@/ui/icons';
import { pressable } from '@/ui/pressable';
import { Skeleton } from '@/ui/Skeleton';

/** One chat (771:105): its title and date, then the opening of its first answer. */
function ChatRow({
  thread,
  onOpen,
}: {
  thread: AssistantThreadSummary;
  onOpen: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={thread.current ? 'true' : undefined}
        onClick={() => onOpen(thread.id)}
        className={cn(
          pressable,
          'flex w-full flex-col gap-0.5 rounded-md px-3 py-2.5 text-left transition-colors duration-fast ease-standard',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          thread.current ? 'bg-surface-brand' : 'hover:bg-neutral-50',
        )}
      >
        <span className="flex w-full items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-body-m font-semibold transition-colors duration-base ease-standard',
              thread.current ? 'text-text-brand' : 'text-text-primary',
            )}
          >
            {thread.title}
          </span>
          <span className="shrink-0 text-micro font-medium text-neutral-400">
            {formatHistoryDate(thread.updatedAt)}
          </span>
        </span>
        <span className="block w-full truncate text-body-s font-medium text-text-tertiary">
          {thread.preview || 'Waiting for an answer…'}
        </span>
      </button>
    </li>
  );
}

/**
 * History (771:96): every chat, newest first, with "New chat" at the top. The open one is lit;
 * any other opens in its place. The ⋯ menu clears the open chat.
 */
export function HistoryCard({
  threads,
  loading,
  failed,
  onRetry,
  onOpen,
  onNew,
  onClear,
  canClear,
}: {
  threads: AssistantThreadSummary[] | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onClear: () => void;
  canClear: boolean;
}) {
  return (
    <section
      aria-labelledby="assistant-history"
      className={cn(cardSurface, 'flex min-h-0 flex-col gap-3 p-4 pt-5')}
    >
      <div className="flex items-center gap-1 pl-2">
        <h2 id="assistant-history" className="text-title-l text-text-primary">
          History
        </h2>
        {threads && (
          <span className="text-body-m font-medium text-neutral-400">({threads.length})</span>
        )}
        <span className="flex-1" />
        <FilterDropdown
          align="end"
          trigger={
            <button
              type="button"
              aria-label="History options"
              className={cn(iconButton, '-my-1 text-text-tertiary')}
            >
              <MoreHorizontalIcon aria-hidden className="size-4" />
            </button>
          }
        >
          {canClear ? (
            <MenuItem tone="danger" onSelect={onClear}>
              Clear this chat
            </MenuItem>
          ) : (
            <p className="px-2 py-1.5 text-body-s text-text-tertiary">This chat is empty.</p>
          )}
        </FilterDropdown>
      </div>

      <button
        type="button"
        onClick={onNew}
        className={cn(
          pressable,
          'flex h-control-md items-center justify-center gap-2 rounded-md border border-dashed border-border-brand-strong bg-surface-card text-body-m font-semibold text-text-brand hover:bg-surface-brand',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        )}
      >
        <PlusIcon aria-hidden className="size-3" />
        New chat
      </button>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-14 rounded-md" />
          ))}
        </div>
      ) : failed ? (
        <p role="alert" className="px-1 py-2 text-body-s text-text-tertiary">
          Couldn&apos;t load your chats.{' '}
          <button
            type="button"
            onClick={onRetry}
            className="rounded-sm font-semibold text-text-brand transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Try again
          </button>
        </p>
      ) : threads && threads.length === 0 ? (
        <p className="px-1 py-2 text-body-s text-text-tertiary">
          Your chats will show here once you ask something.
        </p>
      ) : (
        <ul className="-mx-1 flex min-h-0 flex-col gap-1 overflow-y-auto px-1 pb-0.5">
          {threads?.map((thread) => (
            <ChatRow key={thread.id} thread={thread} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}
