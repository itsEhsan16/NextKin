'use client';

import type { KbChange } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { formatDay } from '../format';
import { AliasChips, TextAction } from '../ui/ContentBits';

/** A stored stamp ("2024-12-10T12:00:00.000Z") as the boards write a day; anything else as is. */
const shown = (value: string) => (/^\d{4}-\d{2}-\d{2}T/.test(value) ? formatDay(value) : value);

/** Old and new values per field, removed on red and added on green (410:1771 "Field changes"). */
export function FieldChanges({ change }: { change: KbChange }) {
  const source = change.detail.source;
  return (
    <AdminCard
      icon="SwitchHorizontal01"
      title="Field changes"
      trailing={<span className="text-caption-m font-normal text-text-tertiary">Old → new</span>}
      bodyClassName="py-1"
    >
      <dl className="flex flex-col">
        {change.detail.fields.length === 0 && (
          <p className="py-4 text-body-s text-text-secondary">
            No field diff is recorded for this change.
          </p>
        )}
        {change.detail.fields.map((field) => (
          <div
            key={field.field}
            className="flex items-start gap-6 border-b border-neutral-100 py-4 text-body-s"
          >
            <dt className="w-[140px] shrink-0 font-medium text-neutral-700">{field.field}</dt>
            <dd className="flex min-w-0 flex-1 flex-col gap-1.5">
              {'unchanged' in field ? (
                <div className="flex items-center gap-1.5">
                  <AliasChips aliases={field.unchanged} />
                  <span className="pl-1.5 text-text-tertiary">Unchanged</span>
                </div>
              ) : (
                <>
                  {field.from !== null && (
                    <Diff sign="−" tone="remove">
                      {shown(field.from)}
                    </Diff>
                  )}
                  {field.to !== null && (
                    <Diff sign="+" tone="add">
                      {shown(field.to)}
                    </Diff>
                  )}
                </>
              )}
            </dd>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 text-body-s">
          <dt className="w-[140px] shrink-0 font-medium text-neutral-700">Source</dt>
          <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {source ? (
              <>
                <AdminIcon name="Link01" size="sm" className="text-brand-700" />
                <TextAction
                  href={`https://${source.url.replace(/^https?:\/\//, '')}`}
                  icon="ArrowUpRight"
                  className="gap-2"
                >
                  {source.url}
                </TextAction>
                {source.cited ? (
                  <AdminBadge tone="success" icon={<AdminIcon name="Check" size="xs" />}>
                    Cited
                  </AdminBadge>
                ) : (
                  <AdminBadge tone="warning">Not cited</AdminBadge>
                )}
                <span className="flex-1" />
                <span className="text-caption-m font-normal text-text-tertiary">{source.note}</span>
              </>
            ) : (
              <AdminBadge tone="warning" icon={<AdminIcon name="AlertTriangle" size="xs" />}>
                No source cited
              </AdminBadge>
            )}
          </dd>
        </div>
      </dl>
    </AdminCard>
  );
}

function Diff({
  sign,
  tone,
  children,
}: {
  sign: string;
  tone: 'add' | 'remove';
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'flex w-[380px] max-w-full items-center gap-3 rounded-sm border px-3 py-2',
        tone === 'remove'
          ? 'border-danger-600/30 bg-danger-50 text-text-secondary'
          : 'border-success-600/30 bg-success-50 text-text-primary',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'text-body-m font-semibold',
          tone === 'remove' ? 'text-danger-600' : 'text-success-600',
        )}
      >
        {sign}
      </span>
      <span className="sr-only">{tone === 'remove' ? 'Old: ' : 'New: '}</span>
      <span
        className={tone === 'remove' ? 'line-through decoration-text-tertiary' : 'font-semibold'}
      >
        {children}
      </span>
    </span>
  );
}
