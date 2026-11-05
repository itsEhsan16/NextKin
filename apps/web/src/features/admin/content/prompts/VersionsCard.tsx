'use client';

import { useState } from 'react';

import type { PromptDetail } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { formatCount, formatScore } from '../format';
import { TextAction } from '../ui/ContentBits';
import { formatPromptDay } from './promptDates';

const SHOWN = 5;

/**
 * A prompt's versions, newest first (Figma 407:3141): the draft on the indigo wash, the live one
 * badged, each with its date, author and eval score. Five show; the rest open on request. Rows
 * are 12px in and 2px apart, the draft's ringed in brand-100.
 */
export function VersionsCard({ detail }: { detail: PromptDetail }) {
  const [all, setAll] = useState(false);
  const threshold = detail.stage?.threshold ?? null;
  const versions = all ? detail.versions : detail.versions.slice(0, SHOWN);

  return (
    <AdminCard
      icon="GitBranch01"
      title="Versions"
      trailing={<AdminBadge tone="neutral">{detail.versions.length}</AdminBadge>}
      bodyClassName="gap-0.5 p-2"
    >
      <ul className="flex flex-col gap-0.5">
        {versions.map((v) => {
          const draft = v.status === 'draft' || v.status === 'staged';
          return (
            <li
              key={v.version}
              className={cn(
                'flex items-center gap-3 rounded-sm p-3',
                draft && 'border border-brand-100 bg-brand-50',
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-body-s font-semibold',
                      draft ? 'text-brand-700' : 'text-text-primary',
                    )}
                  >
                    v{v.version}
                  </span>
                  {draft && (
                    <AdminBadge tone="brand" dot>
                      {v.status === 'staged' ? 'Staged' : 'Draft'}
                    </AdminBadge>
                  )}
                  {v.status === 'active' && (
                    <AdminBadge tone="success" dot>
                      Active
                    </AdminBadge>
                  )}
                </div>
                <span className="truncate text-caption-m font-normal text-text-secondary">
                  {formatPromptDay(v.createdAt)}
                  {v.author && ` · ${v.author}`}
                </span>
              </div>
              {v.evalScore !== null && (
                <AdminBadge
                  tone={threshold === null || v.evalScore >= threshold ? 'success' : 'danger'}
                >
                  {formatScore(v.evalScore)}
                </AdminBadge>
              )}
            </li>
          );
        })}
      </ul>
      {detail.versions.length > SHOWN && (
        <div className="pb-1 pl-3 pt-2">
          <TextAction size="md" onClick={() => setAll((open) => !open)}>
            {all ? 'Show fewer' : `Show all ${detail.versions.length} versions`}
          </TextAction>
        </div>
      )}
    </AdminCard>
  );
}

/** The stage the prompt belongs to: who uses it, its eval set and threshold, how often it runs. */
export function StageCard({ stage }: { stage: NonNullable<PromptDetail['stage']> }) {
  return (
    <AdminCard icon="Settings01" title="Stage" bodyClassName="px-5 py-1">
      {/* The board's 100px medium label column (408:2027), not `DetailList`'s 160. */}
      <dl className="flex flex-col">
        {[
          { label: 'Used by', value: stage.usedBy },
          { label: 'Eval set', value: stage.evalSet },
          { label: 'Threshold', value: formatScore(stage.threshold) },
          { label: 'Runs, 7 days', value: formatCount(stage.runs7d) },
          { label: 'Editors', value: stage.editors },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center gap-4 border-b border-neutral-100 py-3 text-body-s last:border-b-0"
          >
            <dt className="w-[100px] shrink-0 whitespace-nowrap font-medium text-text-secondary">
              {row.label}
            </dt>
            <dd className="min-w-0 flex-1 text-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
    </AdminCard>
  );
}
