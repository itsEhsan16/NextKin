'use client';

import type { Route } from 'next';

import type { AnalyticsProviderUsage, AnalyticsRange } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { formatCount, formatRate, formatUsd, RANGE_DAYS } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { adminTable } from '../../ui/AdminTable';
import { CardMenu } from '../../ui/CardMenu';
import { formatDollars, formatTokens } from '../businessFormat';
import { Track } from '../ui/BusinessParts';

/** At or above this error rate a tag's badge turns amber (Figma 408:1368). */
const ERROR_WARN = 0.01;

const PROMPTS = [{ label: 'Open AI prompts', href: '/admin/prompts' as Route }];

/**
 * Model calls by pipeline tag (Figma 408:1368): calls, tokens, cost and cost per call, the cache
 * hit rate and the error rate, totalled at the foot. Counts only: no prompt or output is kept here.
 */
export function ProviderUsageCard({
  usage,
  range,
}: {
  usage: AnalyticsProviderUsage | null;
  range: AnalyticsRange;
}) {
  return (
    <AdminCard
      icon="CoinsStacked01"
      title="Provider usage & cost"
      trailing={
        usage && usage.rows.length > 0 ? (
          <AdminBadge tone="neutral">
            {formatUsd(usage.totalUsd)} · last {RANGE_DAYS[range]} days
          </AdminBadge>
        ) : undefined
      }
      bodyClassName="p-0 overflow-x-auto"
    >
      {!usage ? (
        <NotConnected what="model usage" />
      ) : usage.rows.length === 0 ? (
        <CardEmpty
          title="No model calls in this window"
          message="Calls show here by pipeline tag."
        />
      ) : (
        <>
          <table className={cn(adminTable.table, 'min-w-[1100px]')}>
            <thead className={adminTable.head}>
              <tr>
                <th scope="col" className={adminTable.th}>
                  Provider / tag
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[146px]')}>
                  Calls
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[146px]')}>
                  Tokens
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[136px]')}>
                  Cost
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[146px]')}>
                  Cost per call
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[216px]')}>
                  Cache hit rate
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[136px]')}>
                  Error rate
                </th>
                <th scope="col" className={cn(adminTable.th, 'w-[52px]')}>
                  <span className="sr-only">More</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {usage.rows.map((row) => (
                <tr key={row.tag} className={adminTable.row}>
                  <td className={adminTable.td}>
                    <p className={adminTable.primary}>{row.tag}</p>
                    {row.provider && <p className={adminTable.secondary}>{row.provider}</p>}
                  </td>
                  <td className={cn(adminTable.td, 'tabular-nums')}>{formatCount(row.calls)}</td>
                  <td className={cn(adminTable.td, 'tabular-nums')}>
                    {row.tokens === null ? '—' : formatTokens(row.tokens)}
                  </td>
                  <td className={cn(adminTable.td, 'tabular-nums')}>
                    {formatDollars(row.costUsd)}
                  </td>
                  <td className={cn(adminTable.td, 'tabular-nums')}>
                    {row.calls ? formatDollars(row.costUsd / row.calls, 3) : '—'}
                  </td>
                  <td className={adminTable.td}>
                    {row.cacheHitRate === null ? (
                      '—'
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div className="w-[120px]">
                          <Track share={row.cacheHitRate} fill="bg-brand-600" />
                        </div>
                        <span className="font-medium tabular-nums text-neutral-700">
                          {formatRate(row.cacheHitRate, 0)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className={adminTable.td}>
                    {row.errorRate === null ? (
                      '—'
                    ) : (
                      <AdminBadge tone={row.errorRate >= ERROR_WARN ? 'warning' : 'success'} dot>
                        {formatRate(row.errorRate)}
                      </AdminBadge>
                    )}
                  </td>
                  <td className={adminTable.td}>
                    <CardMenu label={row.tag} items={PROMPTS} size="md" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2 border-t border-neutral-100 bg-neutral-50 px-6 pb-3.5 pt-3 text-caption-m font-normal text-text-secondary">
            <AdminIcon name="InfoCircle" size="sm" className="text-neutral-400" />
            <span className="flex-1">
              Totals per tag across all users. Prompts and outputs are not stored here; only counts,
              tokens and cost.
            </span>
            <span className="text-body-s font-semibold tabular-nums text-text-primary">
              Total {formatDollars(usage.totalUsd)}
            </span>
          </div>
        </>
      )}
    </AdminCard>
  );
}
