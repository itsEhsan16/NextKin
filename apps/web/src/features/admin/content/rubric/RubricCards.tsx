'use client';

import type { RubricOverview } from '@nextkin/shared/models';

import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge, TrendBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { formatCount } from '../format';
import { ActionButton } from '../ui/ContentBits';
import { PassRate } from './RubricExtras';

/**
 * Which version the rationale and the dry run describe: the draft while there is one. When the
 * reader is viewing another version (`other`), the cards name the draft in their titles, so they
 * don't read as describing the version in view. `null` with no draft.
 */
export type DraftScope = { version: number; other: boolean };

/** Why the draft's weights moved and what backs it (Figma 408:3123 "Rationale & evidence"). */
export function RationaleCard({
  rationale,
  scope,
  onEdit,
}: {
  rationale: NonNullable<RubricOverview['rationale']>;
  scope: DraftScope | null;
  onEdit: (() => void) | null;
}) {
  return (
    <AdminCard
      icon="BookOpen01"
      title={
        scope?.other ? `Rationale & evidence · v${scope.version} draft` : 'Rationale & evidence'
      }
      trailing={
        onEdit && (
          // -my-1 keeps the header at the board's 54px around the 38px button (409:2468).
          <ActionButton variant="small" icon="Edit03" onClick={onEdit} className="-my-1">
            Edit
          </ActionButton>
        )
      }
      bodyClassName="grid gap-8 @min-[1000px]/admin:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="flex flex-col gap-3">
        {rationale.paragraphs.map((p, i) => (
          <p key={i} className="text-body-m leading-6 text-neutral-700">
            {p}
          </p>
        ))}
        {rationale.byline && <p className="text-body-s text-text-tertiary">{rationale.byline}</p>}
      </div>
      {rationale.evidence.length > 0 && (
        <div className="flex flex-col gap-1 border-neutral-100 @min-[1000px]/admin:border-l @min-[1000px]/admin:pl-6">
          <h3 className="text-body-s font-semibold text-text-primary">Evidence</h3>
          <ul className="flex flex-col gap-1">
            {rationale.evidence.map((e) => (
              <li key={e.title} className="flex items-center gap-3 py-2.5 text-body-s">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-neutral-200 bg-surface-card text-neutral-500 shadow-button-xs">
                  <AdminIcon name="File06" size="md" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold text-brand-700">{e.title}</span>
                  <span className="text-text-secondary">{e.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminCard>
  );
}

/** The draft's dry run over recent checks (Figma 408:3123 "Score impact on recent checks"). */
export function ImpactCard({
  impact,
  scope,
  activeVersion,
}: {
  impact: NonNullable<RubricOverview['impact']>;
  scope: DraftScope;
  activeVersion: number | null;
}) {
  const delta = Math.abs(Number((impact.meanTo - impact.meanFrom).toFixed(1)));
  return (
    <AdminCard
      icon="BarChart10"
      title={
        scope.other
          ? `Score impact of the v${scope.version} draft on recent checks`
          : 'Score impact on recent checks'
      }
      trailing={<AdminBadge tone="neutral">Dry run · nothing saved</AdminBadge>}
      // Both halves grow from zero, so the right one is its divider and inset wider (409:2516).
      bodyClassName="flex flex-col gap-8 @min-[1000px]/admin:flex-row"
    >
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <p className="text-display-l font-semibold tracking-[-0.015em] text-text-primary">
              {impact.meanFrom} → {impact.meanTo}
            </p>
            <TrendBadge up={impact.meanTo >= impact.meanFrom}>{delta} pts</TrendBadge>
          </div>
          <p className="text-body-s text-text-secondary">
            Mean score on {formatCount(impact.checks)} checks from the last 30 days, re-scored with
            v{scope.version}
          </p>
        </div>
        <p className="text-body-s text-text-secondary">{impact.note}</p>
      </div>
      <div className="flex flex-1 flex-col gap-4 border-neutral-100 @min-[1000px]/admin:border-l @min-[1000px]/admin:pl-8">
        <PassRate
          label={`Pass rate (70+) under v${activeVersion ?? '—'}`}
          rate={impact.passFrom}
          fill="bg-neutral-400"
        />
        <PassRate
          label={`Pass rate (70+) under v${scope.version}`}
          rate={impact.passTo}
          fill="bg-brand-600"
        />
      </div>
    </AdminCard>
  );
}
