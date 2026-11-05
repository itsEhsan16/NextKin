'use client';

import type { FailureDetail, FailureStage } from '@nextkin/shared/models';
import { useFailureDetail } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Spinner } from '@/ui/Spinner';

import { AdminBadge } from '../../ui/AdminBadge';
import { NotConnected } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { AdminDrawer, DetailList, PanelHeading } from '../../ui/AdminDrawer';
import { FeaturedIcon } from '../../ui/FeaturedIcon';
import { ageOf, formatShortDay, formatSpan, formatStamp, masked } from '../trustFormat';
import { FailureStatusBadge } from './FailureStatusBadge';
import { kindLabel } from './FailuresTable';

export type RunDrawerProps = {
  runId: string | null;
  onClose: () => void;
  onRetry: (id: string) => void;
  onResolve: (id: string) => void;
  busy: 'retry' | 'resolve' | null;
};

/**
 * One failed run (Figma 406:1691): its stages as a timeline, the error, the prompt, model, tokens
 * and timing, and the user by reference. Resume content is never shown here: opening it needs a
 * recorded reason, on the user's page. Retry and resolve are both audited.
 */
export function RunDrawer({ runId, onClose, onRetry, onResolve, busy }: RunDrawerProps) {
  const detail = useFailureDetail(runId);
  const run = detail.data;

  return (
    <AdminDrawer
      open={runId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={runId ? masked('run', runId) : ''}
      badge={run && <FailureStatusBadge status={run.status} />}
      subtitle={
        run
          ? `${kindLabel(run.kind)} · ${masked('user', run.userRef)} · failed ${ageOf(run.failedAt)}`
          : undefined
      }
      footerNote="Both actions are audited"
      actions={
        run && (
          <>
            <button
              type="button"
              disabled={run.status === 'resolved' || busy !== null}
              onClick={() => onResolve(run.id)}
              className={adminButton.secondary}
            >
              {busy === 'resolve' && <Spinner className="size-4" />}
              Mark resolved
            </button>
            <RetryButton
              disabled={run.status !== 'open' || busy !== null}
              busy={busy === 'retry'}
              onClick={() => onRetry(run.id)}
            />
          </>
        )
      }
    >
      {detail.isPending ? (
        <div aria-hidden className="flex flex-col gap-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : run === null ? (
        <NotConnected what="run details" />
      ) : detail.isError || !run ? (
        <StateView
          tone="danger"
          title="Couldn’t load this run"
          actionLabel="Try again"
          onAction={() => void detail.refetch()}
        />
      ) : (
        <Body run={run} />
      )}
    </AdminDrawer>
  );
}

function Body({ run }: { run: FailureDetail }) {
  return (
    <>
      <PanelHeading>Stages</PanelHeading>
      <ol className="flex flex-col">
        {run.stages.map((stage, index) => (
          <Stage key={stage.name} stage={stage} last={index === run.stages.length - 1} />
        ))}
      </ol>

      <PanelHeading>Error</PanelHeading>
      <div className="flex flex-col gap-1.5 rounded-[10px] border border-neutral-200 bg-neutral-50 px-4 py-3.5">
        <p className="flex items-center gap-2 text-body-s font-semibold tracking-[0.02em] text-danger-600">
          <AdminIcon name="AlertTriangle" size="sm" />
          {run.errorCode}
        </p>
        <p className="text-caption-m font-normal leading-5 tracking-[0.02em] text-neutral-700">
          {run.error.message}
        </p>
        <p className="whitespace-pre text-caption-m font-normal leading-5 tracking-[0.02em] text-neutral-700">
          {`request_id  ${run.error.requestRef ? `req_···${run.error.requestRef.slice(-4)}` : '—'}   stage  ${run.stage}`}
        </p>
        <p className="whitespace-pre text-caption-m font-normal leading-5 tracking-[0.02em] text-neutral-700">
          {`retry_policy  ${run.error.retryPolicy}`}
        </p>
      </div>

      <PanelHeading>Run details</PanelHeading>
      <DetailList
        rows={[
          {
            label: 'Prompt version',
            // A run that was never claimed has no pinned version; a seeded one has no publish date.
            value: run.prompt ? (
              <>
                <AdminBadge tone="brand">
                  {run.prompt.name} v{run.prompt.version}
                </AdminBadge>
                {run.prompt.publishedAt && (
                  <span className="text-text-secondary">
                    published {formatShortDay(run.prompt.publishedAt)}
                  </span>
                )}
              </>
            ) : (
              '—'
            ),
          },
          { label: 'Model', value: run.model ?? '—' },
          {
            label: 'Tokens',
            value: `${run.tokensIn.toLocaleString('en-US')} in · ${run.tokensOut.toLocaleString('en-US')} out`,
          },
          { label: 'Started', value: formatStamp(run.startedAt) },
          {
            label: 'Ended',
            value: run.endedAt
              ? `${formatStamp(run.endedAt)} · ${formatSpan(run.startedAt, run.endedAt)}`
              : 'Still running',
          },
          {
            label: 'User',
            value: <AdminBadge tone="neutral">{masked('user', run.userRef)}</AdminBadge>,
          },
        ]}
      />

      <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-body-s text-neutral-700">
        <AdminIcon name="Lock01" className="text-neutral-500" />
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold">Resume content isn’t shown here.</p>
          <p>Opening it needs a recorded reason and is audited.</p>
        </div>
      </div>
    </>
  );
}

const STAGE_LOOK: Record<
  FailureStage['outcome'],
  { tone: 'success' | 'danger' | 'neutral'; icon: 'Check' | 'XClose' | 'Clock' }
> = {
  done: { tone: 'success', icon: 'Check' },
  failed: { tone: 'danger', icon: 'XClose' },
  skipped: { tone: 'neutral', icon: 'Clock' },
};

/** One step of the timeline (Figma 406:1705): its mark, a rule down to the next, and its result. */
function Stage({ stage, last }: { stage: FailureStage; last: boolean }) {
  const look = STAGE_LOOK[stage.outcome];
  return (
    <li className="flex gap-3">
      <div className={cn('flex shrink-0 flex-col items-center gap-1', !last && 'pb-1')}>
        <FeaturedIcon name={look.icon} tone={look.tone} size="sm" />
        {!last && (
          <span
            aria-hidden
            className={cn(
              'h-[18px] w-0.5 rounded-[1px]',
              stage.outcome === 'done' ? 'bg-success-600/35' : 'bg-neutral-200',
            )}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-[5px] text-body-s">
        <p
          className={cn(
            'font-semibold',
            stage.outcome === 'skipped' ? 'text-text-tertiary' : 'text-text-primary',
          )}
        >
          {stage.name}
        </p>
        <p className={stage.outcome === 'failed' ? 'text-danger-600' : 'text-text-secondary'}>
          {stage.detail}
        </p>
      </div>
      <div className="shrink-0 pt-[5px]">
        {stage.outcome === 'done' ? (
          <span className="text-body-s font-medium text-neutral-700">{stage.seconds} s</span>
        ) : (
          <AdminBadge tone={stage.outcome === 'failed' ? 'danger' : 'neutral'}>
            {stage.label}
          </AdminBadge>
        )}
      </div>
    </li>
  );
}

function RetryButton({
  disabled,
  busy,
  onClick,
}: {
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={busy || undefined}
      onClick={onClick}
      {...hoverProps}
      className={adminButton.primary}
    >
      {busy ? <Spinner className="size-4" /> : <AdminIcon ref={iconRef} name="RefreshCw01" />}
      Retry run
    </button>
  );
}
