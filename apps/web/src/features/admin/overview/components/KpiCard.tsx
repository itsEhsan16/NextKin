import type { Route } from 'next';

import type { AdminKpi, AdminKpiKey, AdminRange } from '@nextkin/shared/models';

import type { AdminIconName } from '@/ui/animated/iconMap';
import { Skeleton } from '@/ui/Skeleton';

import { formatCount, formatRate, RANGE_DAYS } from '../../format';
import { Sparkline } from '../../charts/Sparkline';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { DeltaBadge } from '../../ui/AdminBadge';
import { CardMenu } from '../../ui/CardMenu';

/** Each headline card's title and glyph (Figma 395:509, 395:517, 395:525, 395:533). */
const KPI: Record<AdminKpiKey, { title: string; icon: AdminIconName }> = {
  signups: { title: 'New signups', icon: 'Users01' },
  activation: { title: 'Activation rate', icon: 'Zap' },
  reliability: { title: 'Generation reliability', icon: 'CheckCircle' },
  conversion: { title: 'Free → Pro conversion', icon: 'TrendUp01' },
};

const ANALYTICS = [{ label: 'Open Analytics', href: '/admin/analytics' as Route }];

/** One headline figure: its value, how it moved, what that is read against, and its trend. */
export function KpiCard({ kpi, range }: { kpi: AdminKpi; range: AdminRange }) {
  const { title, icon } = KPI[kpi.key];
  const value = kpi.format === 'rate' ? formatRate(kpi.value) : formatCount(kpi.value);
  const basis =
    kpi.basis.kind === 'target'
      ? `target ${formatRate(kpi.basis.rate)}`
      : `vs last ${RANGE_DAYS[range]} days`;
  // Every headline here is better higher, so a fall is the bad direction.
  const falling = (kpi.delta?.value ?? 0) < 0;

  return (
    <AdminCard
      icon={icon}
      title={title}
      trailing={<CardMenu label={title} items={ANALYTICS} />}
      bodyClassName="gap-3"
    >
      <div className="flex items-end justify-between gap-2">
        <p className="animate-reveal text-display-l font-semibold tracking-[-0.015em] text-text-primary">
          {value}
        </p>
        {kpi.trend.length > 1 && (
          <Sparkline values={kpi.trend} tone={falling ? 'danger' : 'brand'} />
        )}
      </div>
      {/* A change needs a previous window; a target is worth showing either way. */}
      {(kpi.delta || kpi.basis.kind === 'target') && (
        <div className="flex flex-wrap items-center gap-2">
          {kpi.delta && <DeltaBadge delta={kpi.delta} />}
          <span className="text-body-s font-medium text-text-secondary">{basis}</span>
        </div>
      )}
    </AdminCard>
  );
}

/**
 * A headline card with no figure: the source doesn't serve it (`notConnected`), or the window has
 * nothing to measure, as a rate over no signups or runs.
 */
export function KpiCardUnavailable({
  kpiKey,
  reason,
}: {
  kpiKey: AdminKpiKey;
  reason: 'notConnected' | 'unmeasured';
}) {
  const { title, icon } = KPI[kpiKey];
  return (
    <AdminCard
      icon={icon}
      title={title}
      trailing={<CardMenu label={title} items={ANALYTICS} />}
      bodyClassName="py-0"
    >
      {reason === 'notConnected' ? (
        <NotConnected what={title.toLowerCase()} />
      ) : (
        <CardEmpty title="Nothing to measure yet" message="It shows once there is activity." />
      )}
    </AdminCard>
  );
}

/** A headline card while its figure loads: its title is known before its value is. */
export function KpiCardSkeleton({ kpiKey }: { kpiKey: AdminKpiKey }) {
  const { title, icon } = KPI[kpiKey];
  return (
    <AdminCard icon={icon} title={title} bodyClassName="gap-3">
      <div className="flex items-end justify-between">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-5 w-40" />
    </AdminCard>
  );
}

export const KPI_KEYS = Object.keys(KPI) as AdminKpiKey[];
