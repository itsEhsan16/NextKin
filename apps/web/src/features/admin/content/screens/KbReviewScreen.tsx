'use client';

import { useState } from 'react';

import { useKbQueue } from '@nextkin/shared/queries';

import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { useAdminCrumb } from '../../shell/adminCrumb';
import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { AdminPage } from '../../ui/AdminPage';
import { ButtonGroup } from '../../ui/ButtonGroup';
import { ReviewDetails } from '../technologies/ReviewDetails';
import { QueueItem } from '../technologies/ReviewParts';
import { ActionButton, TextAction } from '../ui/ContentBits';

type Origin = 'all' | 'imports' | 'staff';
const SHOWN = 8;

/**
 * The KB review queue (Figma 410:1771): every change waiting, and the one in focus in full — its
 * facts, old and new values, the cited source and any user reports. Approving a release date needs
 * a cited source; the decision is written to the audit log with the change.
 */
export function KbReviewScreen() {
  const queue = useKbQueue();
  // Content › Technology KB › Review queue (410:1771).
  useAdminCrumb('Review queue');
  const [origin, setOrigin] = useState<Origin>('all');
  // `null` until Show more/fewer is pressed: the list then opens by itself for a change below eight.
  const [all, setAll] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  // A row's "Open in review queue" names its technology (?tech=Next.js): its first change opens
  // until another is picked. Read once on the client; nothing it decides renders before the data.
  const [wanted] = useState(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('tech'),
  );

  const changes = queue.data ?? [];
  const imports = changes.filter((c) => c.origin === 'import');
  const staff = changes.filter((c) => c.origin !== 'import');
  const listed = origin === 'imports' ? imports : origin === 'staff' ? staff : changes;
  const arrival = wanted
    ? listed.find((c) => c.detail.technology.startsWith(`${wanted} · `))?.id
    : undefined;
  const selectedId = picked ?? arrival ?? null;
  const index = Math.max(
    0,
    listed.findIndex((c) => c.id === selectedId),
  );
  const selected = listed[index];
  // The whole list opens when the change in focus sits below the first eight.
  const open = all ?? index >= SHOWN;
  const visible = open ? listed : listed.slice(0, SHOWN);
  const count = queue.data ? changes.length : undefined;

  const select = (id: string | null) => {
    setPicked(id);
    if (listed.findIndex((c) => c.id === id) >= SHOWN) setAll(null);
  };

  return (
    <AdminPage
      title="Review queue"
      subtitle={
        count === undefined
          ? 'Approve, edit or reject each change waiting'
          : `${count} ${count === 1 ? 'change' : 'changes'} waiting · approve, edit or reject each one`
      }
      actions={
        <ActionButton icon="File06" href="/admin/audit">
          Open import log
        </ActionButton>
      }
    >
      {queue.isError ? (
        <StateView
          tone="danger"
          title="Couldn’t load the queue"
          actionLabel="Try again"
          onAction={() => void queue.refetch()}
        />
      ) : (
        <div className="grid items-start gap-6 @admin-xl/admin:grid-cols-[420px_minmax(0,1fr)]">
          <AdminCard
            icon="ClipboardCheck"
            title="Changes waiting"
            trailing={count !== undefined && <AdminBadge tone="neutral">{count}</AdminBadge>}
            bodyClassName="gap-0.5 p-2"
          >
            <div className="self-start px-2 pb-2.5 pt-2">
              <ButtonGroup
                label="Where the change came from"
                size="md"
                value={origin}
                onChange={setOrigin}
                options={(
                  [
                    { id: 'all', label: 'All', count: changes.length },
                    { id: 'imports', label: 'Imports', count: imports.length },
                    { id: 'staff', label: 'Staff edits', count: staff.length },
                  ] as const
                ).map((option) => ({
                  ...option,
                  count: queue.data ? option.count : undefined,
                  countTone: option.id === origin ? ('brand' as const) : ('neutral' as const),
                }))}
              />
            </div>
            {queue.isPending ? (
              <div aria-hidden className="flex flex-col gap-2 px-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : listed.length === 0 ? (
              <CardEmpty
                title="Nothing waiting"
                message={
                  changes.length === 0 ? 'The queue is empty.' : 'No change from here is waiting.'
                }
              />
            ) : (
              <>
                <ul className="flex flex-col gap-0.5">
                  {visible.map((change) => (
                    <QueueItem
                      key={change.id}
                      change={change}
                      selected={change.id === selected?.id}
                      onSelect={() => select(change.id)}
                    />
                  ))}
                </ul>
                {listed.length > SHOWN && (
                  <div className="pb-1 pl-3 pt-1.5">
                    <TextAction size="md" onClick={() => setAll(!open)}>
                      {open ? 'Show fewer' : `Show ${listed.length - SHOWN} more`}
                    </TextAction>
                  </div>
                )}
              </>
            )}
          </AdminCard>

          {selected ? (
            <ReviewDetails
              key={selected.id}
              change={selected}
              position={index + 1}
              total={listed.length}
              onStep={(step) => select(listed[index + step]?.id ?? selected.id)}
              onDecided={() => select(listed[index + 1]?.id ?? listed[index - 1]?.id ?? null)}
            />
          ) : queue.isPending ? (
            <div aria-hidden className="flex flex-col gap-6">
              <Skeleton className="h-[260px] w-full rounded-lg" />
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </div>
          ) : (
            <AdminCard icon="File06" title="Change details">
              {changes.length === 0 ? (
                <CardEmpty
                  title="Nothing to review"
                  message="Every change has been decided. New imports and edits will show here."
                />
              ) : (
                <CardEmpty
                  title="No change selected"
                  message="Pick a change from the queue to review it."
                />
              )}
            </AdminCard>
          )}
        </div>
      )}
    </AdminPage>
  );
}
