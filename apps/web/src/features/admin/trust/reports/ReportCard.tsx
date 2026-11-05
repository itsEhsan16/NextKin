'use client';

import type { ReactNode } from 'react';

import {
  REPORT_CATEGORY_LABEL,
  type AbuseReportDetail,
  type ReportAction,
} from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { Skeleton } from '@/ui/Skeleton';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { FeaturedIcon } from '../../ui/FeaturedIcon';
import { formatReceived, formatShortDay, masked } from '../trustFormat';
import { ACTION_COPY, CATEGORY_ICON, STATUS, itemKind, itemRef, reasonLabel } from './reportLabels';

/**
 * The report in focus (Figma 407:1357): what it says, what it points at, the owner by reference,
 * the link's age and views, any prior reports, and the three ways to settle it. A settled report
 * shows how it ended instead of the buttons.
 */
export function ReportCard({
  report,
  onAct,
}: {
  report: AbuseReportDetail | undefined;
  /** Settles the report the card shows, by its id. */
  onAct: (id: string, action: ReportAction) => void;
}) {
  if (!report) {
    return (
      <AdminCard icon="Flag01" title="Report" bodyClassName="gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </AdminCard>
    );
  }

  const status = STATUS[report.status];
  return (
    <AdminCard
      icon="Flag01"
      title={report.id}
      trailing={
        <AdminBadge tone={status.tone} dot>
          {status.label}
        </AdminBadge>
      }
      bodyClassName="gap-5"
    >
      <div className="flex items-center gap-3">
        <FeaturedIcon name={CATEGORY_ICON[report.category]} tone="danger" />
        <div className="flex min-w-0 flex-col">
          <p className="text-body-m font-semibold text-text-primary">
            {REPORT_CATEGORY_LABEL[report.category]}
          </p>
          <p className="text-body-s text-text-secondary">
            Received {formatReceived(report.receivedAt)} · from Anonymous
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-body-s font-medium text-text-secondary">Reporter’s reason</p>
        <blockquote className="rounded-[10px] border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-body-s text-neutral-800">
          {report.reason}
        </blockquote>
      </div>

      <dl className="flex flex-col">
        <Row label="Category">
          <AdminBadge tone="danger">{REPORT_CATEGORY_LABEL[report.category]}</AdminBadge>
        </Row>
        <Row label="Reported item">
          <AdminBadge tone="neutral">{itemRef(report.item)}</AdminBadge>
          <span className="text-text-secondary">{itemKind(report.item)}</span>
        </Row>
        <Row label="Owner">
          <AdminBadge tone="neutral">{masked('user', report.ownerRef)}</AdminBadge>
        </Row>
        <Row label="Link created">
          {report.linkCreatedAt
            ? `${formatShortDay(report.linkCreatedAt)}${report.views !== null ? ` · ${report.views} views` : ''}`
            : '—'}
        </Row>
        <Row label="Prior reports">
          {report.prior ? (
            <>
              <AdminBadge tone="warning">{report.prior.count} prior</AdminBadge>
              <span className="text-text-secondary">{report.prior.note}</span>
            </>
          ) : (
            <span className="text-text-secondary">None</span>
          )}
        </Row>
      </dl>

      {report.status === 'open' ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <ActionButton
              label="Dismiss"
              onClick={() => onAct(report.id, 'dismiss')}
              className="min-w-0 flex-1 px-2"
            />
            <ActionButton
              label="Disable public link"
              icon="Link01"
              onClick={() => onAct(report.id, 'disable_link')}
              className="min-w-0 flex-1 px-2"
            />
          </div>
          <ActionButton
            label="Suspend user…"
            icon="UserX01"
            variant="danger"
            onClick={() => onAct(report.id, 'suspend_owner')}
          />
        </div>
      ) : (
        report.outcome && (
          <p className="rounded-sm border border-neutral-200 px-3.5 py-3 text-body-s text-text-secondary">
            <span className="font-semibold text-text-primary">
              Settled: {ACTION_COPY[report.outcome.action].done}
            </span>{' '}
            · {reasonLabel(report.outcome.action, report.outcome.reason)} ·{' '}
            {formatShortDay(report.outcome.at)}
          </p>
        )
      )}

      <div className="flex gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-body-s text-neutral-700">
        <AdminIcon name="ClipboardCheck" className="text-neutral-500" />
        <p>
          Each action asks for a reason code and is written to the audit log with your name. The
          reporter is never told who acted.
        </p>
      </div>
    </AdminCard>
  );
}

/** A label-value row with the board's 110px label (Figma 407:1376). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-b border-neutral-100 py-3 last:border-b-0">
      <dt className="w-[110px] shrink-0 text-body-s font-medium text-text-secondary">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-body-s text-text-primary">
        {children}
      </dd>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  variant = 'secondary',
  onClick,
  className,
}: {
  label: string;
  icon?: AdminIconName;
  variant?: 'secondary' | 'danger';
  onClick: () => void;
  className?: string;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverProps}
      className={cn(
        variant === 'danger' ? adminButton.danger : adminButton.secondary,
        'w-full',
        className,
      )}
    >
      {icon && <AdminIcon ref={iconRef} name={icon} />}
      {label}
    </button>
  );
}
