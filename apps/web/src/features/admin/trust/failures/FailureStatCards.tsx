'use client';

import type { FailureStats } from '@nextkin/shared/models';

import { formatCount, formatRate } from '../../format';
import { RetryCaption } from '../../people/components/StatsCaption';
import { NotConnected } from '../../ui/AdminCard';
import { AdminBadge, TrendBadge } from '../../ui/AdminBadge';
import { StatCard } from '../../ui/StatCard';

/**
 * The four cards over the failed runs (Figma 406:1356): how many failed in 30 days, how many are
 * open, how many a manual retry saved and the commonest cause. A failed load keeps the cards and
 * offers a retry; "Not connected yet" is only for a source that serves no counts (§171.4).
 */
export function FailureStatCards({
  stats,
  loading,
  failed,
  onRetry,
}: {
  stats: FailureStats | null | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  if (!loading && !failed && stats === null) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        <NotConnected what="failure counts" />
      </div>
    );
  }
  const s = failed ? undefined : (stats ?? undefined);
  const value = (pick: (s: FailureStats) => string) => (failed ? '—' : s && pick(s));
  const caption = (pick: (s: FailureStats) => string) => (failed ? 'Couldn’t load' : s && pick(s));
  return (
    <div className="grid grid-cols-2 gap-4 @admin-lg/admin:grid-cols-4">
      <StatCard
        icon="FileX02"
        title="Failed (30 days)"
        value={value((s) => formatCount(s.failed30d))}
        badge={
          s && s.totalRuns > 0 && <AdminBadge tone="neutral">{formatRate(s.failedRate)}</AdminBadge>
        }
        caption={
          failed ? (
            <RetryCaption onRetry={onRetry} />
          ) : (
            s && `of ${formatCount(s.totalRuns)} runs, after retries`
          )
        }
      />
      <StatCard
        icon="AlertTriangle"
        title="Open"
        value={value((s) => formatCount(s.open))}
        caption={caption((s) => s.openNote)}
      />
      <StatCard
        icon="CheckCircle"
        title="Retried OK"
        value={value((s) => formatCount(s.retriedOk))}
        badge={s && s.retriedOk > 0 && <TrendBadge up>{formatRate(s.retriedOkRate, 0)}</TrendBadge>}
        caption={failed ? 'Couldn’t load' : 'succeeded on a manual retry'}
      />
      <StatCard
        icon="Clock"
        title="Most common"
        value={value((s) => s.mostCommon?.label ?? '—')}
        caption={caption((s) =>
          s.mostCommon
            ? `at ${s.mostCommon.stage} · ${formatCount(s.mostCommon.runs)} runs`
            : 'no failed runs',
        )}
      />
    </div>
  );
}
