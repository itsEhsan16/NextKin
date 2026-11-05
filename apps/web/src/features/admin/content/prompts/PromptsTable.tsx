'use client';

import type { Route } from 'next';
import Link from 'next/link';

import type { PromptStage } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { AdminBadge } from '../../ui/AdminBadge';
import { adminTable } from '../../ui/AdminTable';
import { CardMenu } from '../../ui/CardMenu';
import { formatRunCost, formatScore, formatSeconds } from '../format';
import { ScoreBadge, VersionChip } from '../ui/ContentBits';
import { formatPromptDay } from './promptDates';

export const promptHref = (name: string) => `/admin/prompts/${encodeURIComponent(name)}` as Route;

/**
 * The pipeline stages and their prompts (Figma 406:662): the stage and what it does, the live
 * version, any draft and whether it can ship, the last eval, cost and latency, and who changed it
 * last. A stage's name opens its page. A missing figure is a slate-400 dash (406:926).
 */

const dash = <span className="text-neutral-400">—</span>;
export function PromptsTable({ stages }: { stages: PromptStage[] }) {
  return (
    // `relative` keeps the sr-only header inside the table's own scroller.
    <div className="relative overflow-x-auto">
      <table className={cn(adminTable.table, 'min-w-[1180px]')}>
        <thead className={adminTable.head}>
          <tr>
            <th scope="col" className={adminTable.th}>
              Stage
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[106px]')}>
              Active
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[156px]')}>
              Draft
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[156px]')}>
              Last eval
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[126px]')}>
              Cost per run
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[126px]')}>
              p95 latency
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[156px]')}>
              Updated
            </th>
            <th scope="col" className={cn(adminTable.th, 'w-[52px]')}>
              <span className="sr-only">More</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage) => (
            <tr key={stage.name} className={adminTable.row}>
              <td className={adminTable.td}>
                <Link
                  href={promptHref(stage.name)}
                  className="group/stage flex flex-col rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <span className={cn(adminTable.primary, 'group-hover/stage:text-brand-700')}>
                    {stage.name}
                  </span>
                  <span className={adminTable.secondary}>{stage.description}</span>
                </Link>
              </td>
              <td className={adminTable.td}>
                {stage.activeVersion > 0 ? <VersionChip version={stage.activeVersion} /> : dash}
              </td>
              <td className={adminTable.td}>
                {stage.draft ? (
                  <div className="flex flex-col items-start gap-1">
                    <AdminBadge tone={stage.draft.state === 'ready' ? 'success' : 'brand'} dot>
                      v{stage.draft.version} draft
                    </AdminBadge>
                    <span className="text-caption-m font-normal text-text-secondary">
                      {stage.draft.state === 'ready' ? 'ready to publish' : 'awaiting eval'}
                    </span>
                  </div>
                ) : (
                  dash
                )}
              </td>
              <td className={adminTable.td}>
                {stage.lastEval ? (
                  <div className="flex flex-col items-start gap-1">
                    <ScoreBadge score={stage.lastEval.score} passed={stage.lastEval.passed} />
                    <span className="text-caption-m font-normal text-text-secondary">
                      v{stage.lastEval.version} ·{' '}
                      {stage.lastEval.passed || stage.threshold === null
                        ? formatPromptDay(stage.lastEval.at, false)
                        : `below ${formatScore(stage.threshold)}`}
                    </span>
                  </div>
                ) : (
                  dash
                )}
              </td>
              <td className={cn(adminTable.td, 'text-text-primary')}>
                {stage.costPerRunUsd !== null ? formatRunCost(stage.costPerRunUsd) : dash}
              </td>
              <td className={adminTable.td}>
                {stage.p95Seconds !== null ? formatSeconds(stage.p95Seconds) : dash}
              </td>
              <td className={adminTable.td}>
                <div className="flex flex-col">
                  <span className="text-text-primary">{formatPromptDay(stage.updatedAt)}</span>
                  {stage.updatedBy && <span>{stage.updatedBy}</span>}
                </div>
              </td>
              <td className={adminTable.td}>
                <CardMenu
                  label={stage.name}
                  size="md"
                  items={[{ label: `Open ${stage.name}`, href: promptHref(stage.name) }]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
