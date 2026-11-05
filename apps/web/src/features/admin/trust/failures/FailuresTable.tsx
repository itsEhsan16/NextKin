'use client';

import {
  FAILURE_KIND_LABEL,
  type FailureKind,
  type GenerationFailure,
} from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCheckbox, adminTable } from '../../ui/AdminTable';
import { RowMenu } from '../RowMenu';
import { ageOf, masked } from '../trustFormat';
import { FailureStatusBadge } from './FailureStatusBadge';

/** The board's columns (Figma 406:1429), with its 16px between them: 130/130/170/170/140/100/90. */
const COLUMNS = [
  { label: 'Run ID', width: 'w-[146px]' },
  { label: 'Kind', width: 'w-[146px]' },
  { label: 'Failed at stage', width: 'w-[186px]' },
  { label: 'Error code', width: 'w-[186px]' },
  { label: 'User', width: 'w-[156px]' },
  { label: 'Attempts', width: 'w-[116px]' },
  { label: 'Age', width: 'w-[106px]' },
  { label: 'Status', width: '' },
];

const th = cn(adminTable.th, 'px-2 first:pl-6 last:pr-4');
const td = cn(adminTable.td, 'px-2 first:pl-6 last:pr-4');

export type FailuresTableProps = {
  rows: GenerationFailure[];
  selected: Set<string>;
  onSelect: (ids: string[], on: boolean) => void;
  onOpen: (id: string) => void;
  onRetry: (id: string) => void;
  onResolve: (id: string) => void;
};

export const kindLabel = (kind: FailureKind) => FAILURE_KIND_LABEL[kind];

/**
 * Failed runs, one per row (Figma 406:1428): the run, its kind, the stage and error it failed
 * on, the user, attempts, age and status. A row opens its run in the drawer; the ⋮ retries or
 * resolves it; ticking rows feeds Retry selected.
 */
export function FailuresTable({
  rows,
  selected,
  onSelect,
  onOpen,
  onRetry,
  onResolve,
}: FailuresTableProps) {
  const ids = rows.map((row) => row.id);
  const ticked = ids.filter((id) => selected.has(id)).length;

  return (
    <table className={cn(adminTable.table, 'min-w-[1240px]')}>
      <thead className={adminTable.head}>
        <tr>
          <th scope="col" className={cn(th, 'w-[48px]')}>
            <AdminCheckbox
              label="Select every run on this page"
              checked={ticked > 0 && ticked === ids.length}
              indeterminate={ticked > 0 && ticked < ids.length}
              onChange={(on) => onSelect(ids, on)}
            />
          </th>
          {COLUMNS.map((column) => (
            <th key={column.label} scope="col" className={cn(th, column.width)}>
              {column.label}
            </th>
          ))}
          <th scope="col" className={cn(th, 'w-[44px]')}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const run = masked('run', row.id);
          const isSelected = selected.has(row.id);
          return (
            <tr
              key={row.id}
              onClick={() => onOpen(row.id)}
              className={cn(
                adminTable.row,
                'cursor-pointer',
                isSelected && 'bg-brand-50 hover:bg-brand-50',
              )}
            >
              <td className={td} onClick={(event) => event.stopPropagation()}>
                <AdminCheckbox
                  label={`Select ${run}`}
                  checked={isSelected}
                  onChange={(on) => onSelect([row.id], on)}
                />
              </td>
              <td className={td}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(row.id);
                  }}
                  aria-label={`Open ${run}`}
                  className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <AdminBadge tone="neutral">{run}</AdminBadge>
                </button>
              </td>
              <td className={cn(td, 'text-text-primary')}>{kindLabel(row.kind)}</td>
              <td className={td}>
                <AdminBadge tone="neutral">{row.stage}</AdminBadge>
              </td>
              <td className={cn(td, 'font-semibold text-neutral-800')}>{row.errorCode}</td>
              <td className={td}>
                <AdminBadge tone="neutral">{masked('user', row.userRef)}</AdminBadge>
              </td>
              <td className={td}>
                {row.attempts} of {row.maxAttempts}
              </td>
              <td className={td}>
                <time dateTime={row.failedAt}>{ageOf(row.failedAt)}</time>
              </td>
              <td className={td}>
                <FailureStatusBadge status={row.status} />
              </td>
              <td className={td} onClick={(event) => event.stopPropagation()}>
                <RowMenu
                  label={run}
                  items={[
                    { label: 'View run', onSelect: () => onOpen(row.id) },
                    {
                      label: 'Retry run',
                      onSelect: () => onRetry(row.id),
                      disabled: row.status !== 'open',
                    },
                    {
                      label: 'Mark resolved',
                      onSelect: () => onResolve(row.id),
                      disabled: row.status === 'resolved',
                    },
                  ]}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
