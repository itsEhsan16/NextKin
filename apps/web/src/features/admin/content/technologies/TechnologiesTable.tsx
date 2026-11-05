'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';

import type { Technology } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge, type AdminBadgeTone } from '../../ui/AdminBadge';
import { adminTable, SortHeader } from '../../ui/AdminTable';
import { formatDay } from '../format';
import { AliasChips } from '../ui/ContentBits';
import { RowMenu } from '../ui/RowMenu';

const STATUS: Record<Technology['status'], { label: string; tone: AdminBadgeTone }> = {
  in_review: { label: 'In review', tone: 'info' },
  published: { label: 'Published', tone: 'success' },
  needs_source: { label: 'Needs source', tone: 'warning' },
  reported: { label: 'Reported', tone: 'danger' },
};

/**
 * The KB's entries (Figma 409:2118): the technology and its category, aliases, latest version and
 * release date, whether the date has a cited source, the dataset, who changed it last and where it
 * stands in review. A row's menu edits it, which sends the edit to the review queue.
 */
export function TechnologiesTable({
  rows,
  sort,
  onSort,
  onEdit,
}: {
  rows: Technology[];
  sort: 'asc' | 'desc' | null;
  onSort: () => void;
  onEdit: (technology: Technology) => void;
}) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <table className={cn(adminTable.table, 'min-w-[1180px]')}>
        <thead className={adminTable.head}>
          <tr>
            <th
              scope="col"
              className={adminTable.th}
              aria-sort={sort === null ? 'none' : sort === 'asc' ? 'ascending' : 'descending'}
            >
              <SortHeader label="Technology" direction={sort} onToggle={onSort} />
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[236px]')}>
              Aliases
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[126px]')}>
              Latest version
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[136px]')}>
              Release date
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[116px]')}>
              Source
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[116px]')}>
              Dataset
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[136px]')}>
              Updated
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[136px]')}>
              Status
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[52px]')}>
              <span className="sr-only">More</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tech) => (
            <tr key={tech.id} className={adminTable.row}>
              <td className={adminTable.td}>
                <div className="flex flex-col">
                  <span className={adminTable.primary}>{tech.name}</span>
                  <span className={adminTable.secondary}>{tech.category}</span>
                </div>
              </td>
              <td className={adminTable.td}>
                <AliasChips aliases={tech.aliases} />
              </td>
              <td className={cn(adminTable.td, 'text-text-primary')}>
                {tech.latestVersion ?? '—'}
              </td>
              <td className={adminTable.td}>{formatDay(tech.releaseDate)}</td>
              <td className={adminTable.td}>
                {tech.source === 'cited' ? (
                  <AdminBadge tone="success" icon={<AdminIcon name="Link01" size="xs" />}>
                    Cited
                  </AdminBadge>
                ) : (
                  <AdminBadge tone="warning" icon={<AdminIcon name="AlertTriangle" size="xs" />}>
                    Missing
                  </AdminBadge>
                )}
              </td>
              <td className={adminTable.td}>
                <AdminBadge tone="neutral">{tech.dataset}</AdminBadge>
              </td>
              <td className={adminTable.td}>
                <div className="flex flex-col">
                  <span className="text-text-primary">{formatDay(tech.updatedAt)}</span>
                  <span>{tech.updatedBy}</span>
                </div>
              </td>
              <td className={adminTable.td}>
                <AdminBadge tone={STATUS[tech.status].tone} dot>
                  {STATUS[tech.status].label}
                </AdminBadge>
              </td>
              <td className={adminTable.td}>
                <RowMenu
                  label={tech.name}
                  actions={[
                    { label: 'Edit', onSelect: () => onEdit(tech) },
                    ...(tech.status === 'in_review' || tech.status === 'reported'
                      ? [
                          {
                            label: 'Open in review queue',
                            onSelect: () =>
                              router.push(
                                `/admin/technologies/review?tech=${encodeURIComponent(tech.name)}` as Route,
                              ),
                          },
                        ]
                      : []),
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
