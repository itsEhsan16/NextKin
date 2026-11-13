import type { AdminPipeline } from '@nextkin/shared/models';

import { formatRate } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, NotConnected } from '../../ui/AdminCard';

/**
 * How the generation pipeline is keeping up (Figma 395:827): queue depth, p95, the 3-minute SLA.
 * The SLA is met or missed against the target the source states, and a window with no runs has
 * neither a p95 nor an SLA share to report.
 */
export function PipelineCard({ pipeline }: { pipeline: AdminPipeline | null }) {
  return (
    <AdminCard
      icon="Server01"
      title="Pipeline health"
      trailing={
        pipeline &&
        (pipeline.status === 'healthy' ? (
          <AdminBadge tone="success" dot>
            Healthy
          </AdminBadge>
        ) : (
          <AdminBadge tone="warning" dot>
            Degraded
          </AdminBadge>
        ))
      }
    >
      {pipeline ? (
        <dl className="flex">
          <Stat
            label="Queue depth"
            value={String(pipeline.queueDepth)}
            note={pipeline.queueState}
          />
          <Stat
            label="p95 run time"
            value={pipeline.p95Seconds === null ? '—' : `${pipeline.p95Seconds}s`}
            note={
              pipeline.p95Seconds === null ? 'no runs yet' : `target ${pipeline.p95TargetSeconds}s`
            }
          />
          <Stat
            label="3-min SLA"
            value={pipeline.slaMetRate === null ? '—' : formatRate(pipeline.slaMetRate)}
            note={
              pipeline.slaMetRate === null
                ? 'no runs yet'
                : pipeline.slaMetRate >= pipeline.slaTargetRate
                  ? 'met'
                  : `missed · target ${formatRate(pipeline.slaTargetRate)}`
            }
          />
        </dl>
      ) : (
        <NotConnected what="queue depth or run times" />
      )}
    </AdminCard>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    // `basis-0`: the three get equal content widths, each divider and its padding outside them,
    // as the board's columns start (395:836, 395:840, 395:844).
    <div className="flex min-w-0 flex-1 basis-0 flex-col gap-1 border-neutral-100 not-first:border-l not-first:pl-4">
      <dt className="text-body-s font-medium text-text-secondary">{label}</dt>
      {/* The board's figures are 24/32 at -1%; no type role holds that size. */}
      <dd className="animate-reveal text-admin-h1 text-text-primary">{value}</dd>
      <dd className="text-caption-m font-normal text-text-tertiary">{note}</dd>
    </div>
  );
}
