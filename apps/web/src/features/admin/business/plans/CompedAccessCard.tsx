'use client';

import { useState } from 'react';

import type { CompGrant } from '@nextkin/shared/models';
import { useAdminComps, useEndComp } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { formatCount, maskTarget } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { AdminDialog } from '../../ui/AdminDialog';
import { adminButton } from '../../ui/adminButton';
import { adminTable } from '../../ui/AdminTable';
import { formatDate } from '../businessFormat';
import { IconButton, RowMenu, StaffCell } from '../ui/BusinessParts';

/**
 * Users on Pro for free, for a while (Figma 406:3352): the user by a masked id, how long, why, who
 * granted it and when it ends. Four to a page.
 */
export function CompedAccessCard({ onGrant }: { onGrant: () => void }) {
  const [page, setPage] = useState(1);
  const comps = useAdminComps(page);
  const [ending, setEnding] = useState<CompGrant | null>(null);
  const end = useEndComp();
  const data = comps.data;

  return (
    <AdminCard
      icon="UserPlus01"
      title="Comped access"
      trailing={
        <IconButton icon="Plus" onClick={onGrant} className={adminButton.small}>
          Grant comped access
        </IconButton>
      }
      bodyClassName="p-0 overflow-x-auto"
    >
      {comps.isPending ? (
        <div aria-hidden className="flex flex-col gap-4 p-6">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : comps.isError ? (
        <StateView
          tone="danger"
          title="Couldn’t load comped access"
          actionLabel="Try again"
          onAction={() => void comps.refetch()}
        />
      ) : data === null || data === undefined ? (
        <NotConnected what="the list of comped users" />
      ) : data.rows.length === 0 ? (
        <CardEmpty
          title="Nobody is comped"
          message="Grant comped access to give someone Pro for a while."
        />
      ) : (
        <>
          <table className={cn(adminTable.table, 'min-w-[1100px]')}>
            <thead className={adminTable.head}>
              <tr>
                <th scope="col" className={cn(adminTable.th, 'w-[204px]')}>
                  User
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[136px]')}>
                  Months
                </th>
                <th scope="col" className={adminTable.th}>
                  Reason
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[236px]')}>
                  Granted by
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[166px]')}>
                  Started
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[166px]')}>
                  Ends
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[52px]')}>
                  <span className="sr-only">More</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((grant) => (
                <tr key={grant.id} className={adminTable.row}>
                  <td className={adminTable.td}>
                    <AdminBadge tone="neutral">
                      {maskTarget({ kind: 'user', ref: grant.userRef })}
                    </AdminBadge>
                  </td>
                  <td className={adminTable.td}>
                    {grant.months} month{grant.months === 1 ? '' : 's'}
                  </td>
                  <td className={cn(adminTable.td, 'truncate')}>{grant.reason}</td>
                  <td className={adminTable.td}>
                    {/* A comp made outside the portal has no grant on record: nobody is named. */}
                    {grant.grantedBy ? (
                      <StaffCell name={grant.grantedBy.name} role={grant.grantedBy.role} />
                    ) : (
                      <span className="text-text-tertiary">Not recorded</span>
                    )}
                  </td>
                  <td className={adminTable.td}>{formatDate(grant.startedAt)}</td>
                  <td className={adminTable.td}>{formatDate(grant.endsAt)}</td>
                  <td className={adminTable.td}>
                    <RowMenu
                      label={`comped access for ${maskTarget({ kind: 'user', ref: grant.userRef })}`}
                      items={[
                        {
                          label: 'End comped access',
                          tone: 'danger',
                          onSelect: () => setEnding(grant),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <nav
            aria-label="Pages"
            className="flex items-center gap-3 border-t border-neutral-200 px-6 pb-4 pt-3"
          >
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => setPage(data.page - 1)}
              className={adminButton.small}
            >
              Previous
            </button>
            <p
              aria-live="polite"
              className="flex-1 text-center text-body-s font-medium text-neutral-700"
            >
              Page {data.page} of {data.pages} · {formatCount(data.active)} active
            </p>
            <button
              type="button"
              disabled={data.page >= data.pages}
              onClick={() => setPage(data.page + 1)}
              className={adminButton.small}
            >
              Next
            </button>
          </nav>
        </>
      )}

      {ending && (
        <AdminDialog
          open
          onOpenChange={(open) => !open && setEnding(null)}
          icon="UserX01"
          tone="danger"
          title="End comped access?"
          description={`${maskTarget({ kind: 'user', ref: ending.userRef })} goes back to their own plan now, not on ${formatDate(ending.endsAt)}. This is recorded in the audit log.`}
          confirm={{
            label: 'End comped access',
            variant: 'danger',
            busy: end.isPending,
            onConfirm: () =>
              end.mutate(ending.id, {
                onSuccess: () => {
                  showToast('Comped access ended');
                  setEnding(null);
                },
                onError: (error) =>
                  showToast(error instanceof Error ? error.message : 'That didn’t save.', {
                    tone: 'error',
                  }),
              }),
          }}
        />
      )}
    </AdminCard>
  );
}
