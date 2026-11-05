import type { ReactNode } from 'react';

import type { AdminIconName } from '@/ui/animated/iconMap';
import { Skeleton } from '@/ui/Skeleton';

import { AdminCard } from './AdminCard';

export type StatCardProps = {
  /** Some boards draw a card title with no glyph (Users' "Active, 30 days"). */
  icon?: AdminIconName;
  title: string;
  /** The figure, already formatted: "48,212". `undefined` while it loads. */
  value: ReactNode | undefined;
  /** A badge beside the figure: a change (`DeltaBadge`, `TrendBadge`) or a status. */
  badge?: ReactNode;
  /** The line under the figure: "new in the last 30 days". */
  caption?: ReactNode;
  trailing?: ReactNode;
};

/**
 * A headline figure in a tray card, as the list pages draw a row of them (Users, Figma 404:776):
 * the figure at 26/34, a badge beside it and a caption under it. The Overview's KPI cards are the
 * larger, sparkline variant (`overview/components/KpiCard`).
 */
export function StatCard({ icon, title, value, badge, caption, trailing }: StatCardProps) {
  return (
    <AdminCard icon={icon} title={title} trailing={trailing} bodyClassName="gap-1.5">
      {value === undefined ? (
        <>
          <Skeleton className="h-[34px] w-28" />
          <Skeleton className="h-5 w-36" />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="animate-reveal text-[28.6px] font-semibold leading-[37.4px] tracking-[-0.015em] text-text-primary">
              {value}
            </p>
            {badge}
          </div>
          {caption != null && <p className="text-body-s text-text-secondary">{caption}</p>}
        </>
      )}
    </AdminCard>
  );
}
