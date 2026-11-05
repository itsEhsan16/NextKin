'use client';

import type { PriceSet, PriceVersion } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { adminTable } from '../../ui/AdminTable';
import { formatDate, formatPrice } from '../businessFormat';
import { RowMenu, StaffCell } from '../ui/BusinessParts';

const PRICE_COLUMNS = [
  ['monthly', 'USD'],
  ['monthly', 'EUR'],
  ['monthly', 'AUD'],
  ['annual', 'USD'],
  ['annual', 'EUR'],
  ['annual', 'AUD'],
] as const;

export type PriceBookCardProps = {
  versions: PriceVersion[] | null | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** Opens a new version that starts from this one's prices. */
  onStartFrom: (prices: { monthly: PriceSet; annual: PriceSet }) => void;
};

/**
 * The board's columns (406:3228): fixed widths with 16px between them, the six prices sharing the
 * rest. A cell's width is its column plus the gap; the first adds the 24px inset, the last ⋮ the
 * 16px right edge.
 */
const COL = {
  version: 'w-[174px]',
  effective: 'w-[166px]',
  createdBy: 'w-[216px]',
  status: 'w-[136px]',
  more: 'w-[52px]',
};

/**
 * Every price version, newest first (Figma 406:3221): when it took effect, its six prices, who
 * published it, and whether it is the one checkouts use now.
 */
export function PriceBookCard({
  versions,
  loading,
  error,
  onRetry,
  onStartFrom,
}: PriceBookCardProps) {
  return (
    <AdminCard
      icon="CoinsStacked01"
      title="Price book"
      trailing={
        versions && versions.length > 0 ? (
          <AdminBadge tone="neutral">
            {versions.length} version{versions.length === 1 ? '' : 's'}
          </AdminBadge>
        ) : undefined
      }
      bodyClassName="p-0 overflow-x-auto"
    >
      {loading ? (
        <div aria-hidden className="flex flex-col gap-4 p-6">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <StateView
          tone="danger"
          title="Couldn’t load the price book"
          actionLabel="Try again"
          onAction={onRetry}
        />
      ) : versions === null || versions === undefined ? (
        <NotConnected what="the price history" />
      ) : versions.length === 0 ? (
        <CardEmpty
          title="No price versions yet"
          message="Publish the first one with New price version."
        />
      ) : (
        <>
          <table className={cn(adminTable.table, 'min-w-[1200px]')}>
            <thead className={adminTable.head}>
              <tr>
                <th scope="col" className={cn(adminTable.th, COL.version)}>
                  Version
                </th>
                <th scope="col" className={cn(adminTable.th, COL.effective)}>
                  Effective from
                </th>
                {PRICE_COLUMNS.map(([period, currency]) => (
                  <th key={`${period}-${currency}`} scope="col" className={adminTable.th}>
                    {currency} {period}
                  </th>
                ))}
                <th scope="col" className={cn(adminTable.th, COL.createdBy)}>
                  Created by
                </th>
                <th scope="col" className={cn(adminTable.th, COL.status)}>
                  Status
                </th>
                <th scope="col" className={cn(adminTable.th, COL.more)}>
                  <span className="sr-only">More</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.version} className={adminTable.row}>
                  <td className={adminTable.td}>
                    <p className={adminTable.primary}>v{version.version}</p>
                    {version.status === 'active' && <p className={adminTable.secondary}>Current</p>}
                  </td>
                  <td className={adminTable.td}>{formatDate(version.effectiveFrom)}</td>
                  {PRICE_COLUMNS.map(([period, currency]) => (
                    <td key={`${period}-${currency}`} className={cn(adminTable.td, 'tabular-nums')}>
                      {formatPrice(version[period][currency], currency, true)}
                    </td>
                  ))}
                  <td className={adminTable.td}>
                    {/* The first version came with the seed, not from a staff member. */}
                    {version.createdBy ? (
                      <StaffCell name={version.createdBy.name} role={version.createdBy.role} />
                    ) : (
                      <span className="text-text-tertiary">Initial prices</span>
                    )}
                  </td>
                  <td className={adminTable.td}>
                    {version.status === 'active' ? (
                      <AdminBadge tone="success" dot>
                        Active
                      </AdminBadge>
                    ) : (
                      <AdminBadge tone="neutral" dot>
                        Retired
                      </AdminBadge>
                    )}
                  </td>
                  <td className={adminTable.td}>
                    <RowMenu
                      label={`price version v${version.version}`}
                      items={[
                        {
                          label: 'Start a new version from this',
                          onSelect: () =>
                            onStartFrom({ monthly: version.monthly, annual: version.annual }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="flex items-center gap-2 border-t border-neutral-100 bg-neutral-50 px-6 pb-3.5 pt-3 text-caption-m font-normal text-text-secondary">
            <AdminIcon name="InfoCircle" size="sm" className="text-neutral-400" />
            Prices are stored in minor units (1900 = $19.00) and shown formatted here. A published
            version can’t be edited; publish a new one instead.
          </p>
        </>
      )}
    </AdminCard>
  );
}
