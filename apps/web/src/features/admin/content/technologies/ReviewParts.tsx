'use client';

import type { KbChange, KbFieldChange } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { FeaturedIcon, type FeaturedTone } from '../../ui/FeaturedIcon';
import { formatDay } from '../format';

/** Each kind of change's glyph and tone in the queue (Figma 410:1771). */
export const KIND: Record<KbChange['kind'], { icon: AdminIconName; tone: FeaturedTone }> = {
  date: { icon: 'Calendar', tone: 'brand' },
  alias: { icon: 'Tag01', tone: 'info' },
  new: { icon: 'Plus', tone: 'success' },
  report: { icon: 'Flag01', tone: 'warning' },
  version: { icon: 'Database01', tone: 'brand' },
  category: { icon: 'Edit03', tone: 'neutral' },
};

const ORIGIN: Record<KbChange['origin'], { label: string; icon: AdminIconName }> = {
  import: { label: 'Import', icon: 'UploadCloud02' },
  user_report: { label: 'User report', icon: 'Flag01' },
  staff_edit: { label: 'Staff edit', icon: 'Edit03' },
};

const changed = (fields: KbFieldChange[]) => fields.filter((f) => 'to' in f).length;

/** One row in the queue: the kind's glyph, what changes, where it came from, when. */
export function QueueItem({
  change,
  selected,
  onSelect,
}: {
  change: KbChange;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = KIND[change.kind];
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-[10px] p-3 text-left transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-brand-600',
          // The board's chosen item carries a 1px border (68px); the rest have none (66px).
          selected ? 'border border-brand-100 bg-brand-50' : 'hover:bg-neutral-50',
        )}
      >
        <FeaturedIcon name={kind.icon} tone={kind.tone} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-s">
          <span
            className={cn(
              'truncate font-semibold',
              selected ? 'text-brand-700' : 'text-text-primary',
            )}
          >
            {change.title}
          </span>
          <span className="truncate text-text-secondary">{change.originLabel}</span>
        </span>
        <span className="shrink-0 text-caption-m font-normal text-text-tertiary">
          {formatDay(change.at, false)}
        </span>
      </button>
    </li>
  );
}

/** The change's heading, badges and facts (Figma 410:1771 "Change details"). */
export function ChangeSummary({ change }: { change: KbChange }) {
  const kind = KIND[change.kind];
  const origin = ORIGIN[change.origin];
  const fields = changed(change.detail.fields);
  const reports = change.detail.reports.length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] border border-neutral-200 bg-surface-card text-neutral-700 shadow-xs">
          <AdminIcon name={kind.icon} size="xl" />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-h2 font-semibold leading-7 tracking-[-0.005em] text-text-primary">
            {change.detail.heading}
          </h3>
          <div className="flex flex-wrap gap-2">
            <AdminBadge tone="info" dot>
              In review
            </AdminBadge>
            <AdminBadge tone="neutral" icon={<AdminIcon name={origin.icon} size="xs" />}>
              {origin.label}
            </AdminBadge>
            {fields > 0 && (
              <AdminBadge tone="brand">
                {fields} {fields === 1 ? 'field' : 'fields'} changed
              </AdminBadge>
            )}
            {reports > 0 && (
              <AdminBadge tone="warning" icon={<AdminIcon name="Flag01" size="xs" />}>
                {reports} user {reports === 1 ? 'report' : 'reports'}
              </AdminBadge>
            )}
            <AdminBadge tone="neutral">Targets dataset {change.detail.targetDataset}</AdminBadge>
          </div>
        </div>
      </div>
      <Facts
        rows={[
          { label: 'Technology', value: change.detail.technology },
          { label: 'Proposed by', value: change.detail.proposedBy },
          { label: 'Resumes affected', value: change.detail.resumesAffected },
        ]}
      />
    </div>
  );
}

function Facts({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-col border-t border-neutral-100">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-start gap-4 border-b border-neutral-100 py-3 text-body-s last:border-b-0"
        >
          <dt className="w-40 shrink-0 font-medium text-text-secondary">{row.label}</dt>
          <dd className="min-w-0 flex-1 text-text-primary">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What users disputed about this entry, with who reported it hidden (410:1771). */
export function UserReports({ change }: { change: KbChange }) {
  const reports = change.detail.reports;
  if (reports.length === 0) return null;
  return (
    <AdminCard
      icon="Flag01"
      title={`User reports (${reports.length})`}
      trailing={
        <AdminBadge tone="neutral" icon={<AdminIcon name="Lock01" size="xs" />}>
          Reporter identity hidden
        </AdminBadge>
      }
      bodyClassName="py-1"
    >
      <ul>
        {reports.map((report) => (
          <li
            key={report.id}
            className="flex items-start gap-3 border-b border-neutral-100 py-4 last:border-b-0"
          >
            <FeaturedIcon name="Flag01" tone="warning" />
            <div className="flex min-w-0 flex-col gap-1 text-body-s">
              <p className="font-semibold text-text-primary">{report.title}</p>
              <p className="text-neutral-700">{report.body}</p>
              <p className="text-caption-m font-normal text-text-tertiary">
                {formatDay(report.at)} · {report.origin}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}
