'use client';

import type { AnalyticsRetention } from '@nextkin/shared/models';

import { formatRate } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { fillOf, RetentionHeatmap } from './RetentionHeatmap';

/** The legend's six steps, from pale to the full indigo (Figma 407:1826). */
const LEGEND = [0.08, 0.25, 0.45, 0.65, 0.85, 1];

/**
 * Week-4 retention by cohort (Figma 407:1604): each weekly sign-up cohort's share who came back
 * in each later week, as a heatmap. Week 4 is outlined; weeks that haven't happened yet are
 * dashed. Pointing at a cell says how many of the cohort that was.
 */
export function RetentionCard({ retention }: { retention: AnalyticsRetention | null }) {
  return (
    <AdminCard
      icon="Repeat01"
      title="Week-4 retention by cohort"
      trailing={
        retention?.week4Average != null ? (
          <AdminBadge tone="brand">
            Week 4 average {formatRate(retention.week4Average, 0)}
          </AdminBadge>
        ) : undefined
      }
      bodyClassName="gap-3"
    >
      {!retention ? (
        <NotConnected what="retention by cohort" />
      ) : retention.cohorts.length === 0 ? (
        <CardEmpty
          title="No cohorts yet"
          message="A cohort appears a week after its first sign-ups."
        />
      ) : (
        <Heatmap retention={retention} />
      )}
    </AdminCard>
  );
}

function Heatmap({ retention }: { retention: AnalyticsRetention }) {
  return (
    <>
      <p className="text-body-s text-text-secondary">
        Share of each weekly sign-up cohort that came back to use NextKin in that week. Week 0 is
        the sign-up week.
      </p>
      <RetentionHeatmap retention={retention} />

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-caption-m font-normal text-text-tertiary">
        <span>0%</span>
        {LEGEND.map((rate) => (
          <span
            key={rate}
            aria-hidden
            style={{ backgroundColor: fillOf(rate) }}
            className="h-2.5 w-5 rounded-[2px]"
          />
        ))}
        <span>100%</span>
        <span className="ml-auto">Dashed cells are weeks that haven’t happened yet</span>
      </div>
    </>
  );
}
