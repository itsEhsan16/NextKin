'use client';

import type { RubricCriterion, RubricOverview, RubricVersion } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { adminTable } from '../../ui/AdminTable';
import { RowMenu } from '../ui/RowMenu';
import { ShareBar } from './ShareBar';

/** A version's status badge (Figma 408:3123): Draft, Active since …, Retired. */
export function VersionBadge({ version }: { version: RubricVersion }) {
  if (version.status === 'draft') {
    return (
      <AdminBadge tone="warning" dot>
        Draft
      </AdminBadge>
    );
  }
  if (version.status === 'active') {
    return (
      <AdminBadge tone="success" dot>
        {version.activeSince ? `Active since ${version.activeSince}` : 'Active'}
      </AdminBadge>
    );
  }
  return (
    <AdminBadge tone="neutral" dot>
      Retired
    </AdminBadge>
  );
}

/** The rubric's versions, one chosen to view (Figma 408:3123 "Versions"). */
export function VersionsList({
  versions,
  value,
  onChange,
}: {
  versions: RubricVersion[];
  value: number;
  onChange: (version: number) => void;
}) {
  return (
    <AdminCard
      icon="GitBranch01"
      title="Versions"
      trailing={<AdminBadge tone="neutral">{versions.length}</AdminBadge>}
      bodyClassName="p-2"
    >
      <fieldset>
        <legend className="sr-only">Rubric version to view</legend>
        <div className="flex flex-col gap-1">
          {versions.map((v) => {
            const chosen = v.version === value;
            return (
              <label
                key={v.version}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-[10px] p-3 transition-colors duration-press has-focus-visible:outline-2 has-focus-visible:outline-brand-600',
                  chosen
                    ? // Only the chosen row is outlined, so it is 2px taller, as drawn (408:3295).
                      'border border-brand-100 bg-brand-50'
                    : 'hover:bg-neutral-50',
                )}
              >
                <span className="relative flex size-4 shrink-0">
                  <input
                    type="radio"
                    name="rubric-version"
                    checked={chosen}
                    onChange={() => onChange(v.version)}
                    className="peer size-4 cursor-pointer appearance-none rounded-full border border-neutral-300 bg-surface-card checked:border-brand-600 checked:bg-brand-600 focus-visible:outline-none"
                  />
                  <span className="pointer-events-none absolute inset-0 m-auto size-1.5 rounded-full bg-text-inverse opacity-0 peer-checked:opacity-100" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-body-s font-semibold',
                        chosen ? 'text-brand-700' : 'text-text-primary',
                      )}
                    >
                      v{v.version}
                    </span>
                    <VersionBadge version={v} />
                  </span>
                  <span className="text-body-s text-text-secondary">
                    {v.author} · {v.dateLabel}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </AdminCard>
  );
}

/** What the draft still needs before it can go live (408:3123 "Before v4 can publish"). */
export function ChecklistCard({
  version,
  checklist,
  rollbackTo,
}: {
  version: number;
  checklist: RubricOverview['checklist'];
  rollbackTo: number | null;
}) {
  return (
    <AdminCard icon="ClipboardCheck" title={`Before v${version} can publish`} bodyClassName="gap-3">
      <ul className="flex flex-col gap-3">
        {checklist.map((check) => (
          <li key={check.label} className="flex items-start gap-3 text-body-s">
            <AdminIcon
              name={check.state === 'done' ? 'CheckCircle' : 'Clock'}
              className={check.state === 'done' ? 'text-success-600' : 'text-warning-600'}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold text-text-primary">
                {check.label}
                <span className="sr-only">{check.state === 'done' ? ', done' : ', pending'}</span>
              </span>
              {/* The board keeps each detail on one line (236px column). */}
              <span className="whitespace-nowrap text-text-secondary">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {rollbackTo !== null && (
        <p className="flex items-center gap-2 border-t border-neutral-100 pt-3 text-body-s text-text-secondary">
          <AdminIcon name="FlipBackward" size="sm" className="text-neutral-400" />v{rollbackTo}{' '}
          stays one click away for rollback.
        </p>
      )}
    </AdminCard>
  );
}

/** A criterion's change from the version before, in points (408:3123 "v3 → v4"). */
export function Change({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-text-tertiary">new</span>;
  if (delta === 0) return <AdminBadge tone="neutral">unchanged</AdminBadge>;
  return (
    <AdminBadge
      tone={delta > 0 ? 'success' : 'warning'}
      icon={<AdminIcon name={delta > 0 ? 'ArrowUp' : 'ArrowDown'} size="xs" />}
    >
      {delta > 0 ? '+' : '−'}
      {Math.abs(delta)} pts
    </AdminBadge>
  );
}

/**
 * The board's columns sit 16px apart (408:3371), so the cells pad 8 a side; each width is the
 * board's content width plus that padding (24 before the first, 16 after the ⋮).
 */
const th = cn(adminTable.th, 'px-2 first:pl-6 last:pr-4');
const td = cn(adminTable.td, 'px-2 first:pl-6 last:pr-4');

/** The criteria and their weights, against the version before (408:3123 "Criteria"). */
export function CriteriaTable({
  criteria,
  previous,
  previousVersion,
  version,
  onHistory,
}: {
  criteria: RubricCriterion[];
  previous: RubricCriterion[] | null;
  previousVersion: number | null;
  version: number;
  /** Opens a criterion's weight across every version (the row's ⋮). */
  onHistory: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn(adminTable.table, 'min-w-[900px]')}>
        <thead className={adminTable.head}>
          <tr>
            <th scope="col" className={th}>
              Criterion
            </th>
            <th scope="col" className={cn(th, 'w-[196px]')}>
              Weight
            </th>
            {previousVersion !== null && (
              <th scope="col" className={cn(th, 'w-[136px]')}>
                v{previousVersion} → v{version}
              </th>
            )}
            <th scope="col" className={cn(th, 'w-[226px]')}>
              Evidence
            </th>
            <th scope="col" className={cn(th, 'w-[44px]')}>
              <span className="sr-only">More</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => {
            const before = previous?.find((p) => p.key === c.key);
            return (
              <tr key={c.key} className={adminTable.row}>
                <td className={td}>
                  <div className="flex flex-col">
                    <span className={adminTable.primary}>{c.label}</span>
                    {c.description && <span className={adminTable.secondary}>{c.description}</span>}
                  </div>
                </td>
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <ShareBar value={c.weight} label={`${c.label} weight`} className="w-[120px]" />
                    <span className="font-semibold text-text-primary">{c.weight}%</span>
                  </div>
                </td>
                {previousVersion !== null && (
                  <td className={td}>
                    <Change delta={before ? c.weight - before.weight : null} />
                  </td>
                )}
                <td className={td}>
                  {c.evidence ? (
                    <span className="flex items-center gap-1.5 font-medium text-brand-700">
                      <AdminIcon name="Link01" size="sm" />
                      <span className="truncate">{c.evidence}</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={td}>
                  <RowMenu
                    label={c.label}
                    actions={[
                      { label: 'Weight in every version', onSelect: () => onHistory(c.key) },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
