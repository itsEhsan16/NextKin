'use client';

import type { RubricVersion } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { AdminDialog } from '../../ui/AdminDialog';
import { adminTable } from '../../ui/AdminTable';
import { Change, VersionBadge } from './RubricParts';

const th = cn(adminTable.th, 'px-3 first:pl-4 last:pr-4');
const td = cn(adminTable.td, 'px-3 py-3 first:pl-4 last:pr-4');

/**
 * The active version's weights beside the draft's, criterion by criterion, sized to fit the
 * dialog: the criterion, both weights and the change.
 */
export function CompareDialog({
  open,
  onOpenChange,
  from,
  to,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: RubricVersion;
  to: RubricVersion;
}) {
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="SwitchHorizontal01"
      tone="brand"
      width="lg"
      title={`v${from.version} against v${to.version}`}
      description="Each criterion's share of the score in both versions."
    >
      <table className={adminTable.table}>
        <thead className={adminTable.head}>
          <tr>
            <th scope="col" className={th}>
              Criterion
            </th>
            <th scope="col" className={cn(th, 'w-[96px]')}>
              v{from.version}
            </th>
            <th scope="col" className={cn(th, 'w-[96px]')}>
              v{to.version}
            </th>
            <th scope="col" className={cn(th, 'w-[128px]')}>
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {to.criteria.map((c) => {
            const before = from.criteria.find((p) => p.key === c.key);
            return (
              <tr key={c.key} className={adminTable.row}>
                <td className={cn(td, 'font-semibold text-text-primary')}>{c.label}</td>
                <td className={td}>{before ? `${before.weight}%` : '—'}</td>
                <td className={cn(td, 'font-semibold text-text-primary')}>{c.weight}%</td>
                <td className={td}>
                  <Change delta={before ? c.weight - before.weight : null} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AdminDialog>
  );
}

/** One criterion's weight in every version, newest first (the criteria row's ⋮). */
export function HistoryDialog({
  criterion,
  versions,
  onClose,
}: {
  criterion: string;
  versions: RubricVersion[];
  onClose: () => void;
}) {
  const label =
    versions.flatMap((v) => v.criteria).find((c) => c.key === criterion)?.label ?? criterion;
  return (
    <AdminDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon="GitBranch01"
      tone="brand"
      title={`${label} in every version`}
      description="Its share of the score in each rubric version."
    >
      <ul className="flex flex-col">
        {[...versions]
          .sort((a, b) => b.version - a.version)
          .map((v) => {
            const found = v.criteria.find((c) => c.key === criterion);
            return (
              <li
                key={v.version}
                className="flex items-center gap-3 border-b border-neutral-100 py-3 text-body-s last:border-b-0"
              >
                <span className="font-semibold text-text-primary">v{v.version}</span>
                <VersionBadge version={v} />
                <span className="flex-1" />
                <span className="font-semibold text-text-primary">
                  {found ? `${found.weight}%` : 'Not in this version'}
                </span>
              </li>
            );
          })}
      </ul>
    </AdminDialog>
  );
}
