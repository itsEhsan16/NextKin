import type { AdminAtsDistribution } from '@nextkin/shared/models';

import { Histogram } from '../../charts/Histogram';
import { formatCount } from '../../format';
import { AdminBadge, DeltaBadge, TrendBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';

/**
 * How ATS checks scored across the platform (Figma 396:550): the mean, its change, how many
 * checks, and the spread. The rubric version the scores were made under sits in the header, since
 * a mean across two rubric versions wouldn't mean much.
 */
export function AtsCard({ ats }: { ats: AdminAtsDistribution | null }) {
  const checks = ats?.buckets.reduce((sum, bucket) => sum + bucket.count, 0) ?? 0;

  return (
    <AdminCard
      icon="Scale02"
      title="ATS score distribution"
      trailing={
        ats?.rubricVersion && <AdminBadge tone="brand">Rubric {ats.rubricVersion}</AdminBadge>
      }
      bodyClassName="gap-4"
    >
      {!ats ? (
        <NotConnected what="ATS scores" />
      ) : checks === 0 ? (
        <CardEmpty title="No checks yet" message="Scores show here once people run an ATS check." />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <p className="animate-reveal text-display-l font-semibold tracking-display text-text-primary">
                {ats.mean !== null ? ats.mean : formatCount(checks)}
              </p>
              {/* A change in the mean score is in score points, written bare as the board does
                  ("↑ 2.1", 396:651): "pts" beside a 0–100 score would read as rate points. */}
              {ats.delta &&
                (ats.delta.unit === 'points' ? (
                  <TrendBadge up={ats.delta.value >= 0}>
                    {Math.abs(ats.delta.value)}
                    <span className="sr-only"> points</span>
                  </TrendBadge>
                ) : (
                  <DeltaBadge delta={ats.delta} />
                ))}
            </div>
            <p className="text-body-s text-text-secondary">
              {ats.mean !== null ? `mean score · ${formatCount(checks)} checks` : 'checks scored'}
            </p>
          </div>
          <Histogram buckets={ats.buckets} mean={ats.mean} />
        </>
      )}
    </AdminCard>
  );
}
