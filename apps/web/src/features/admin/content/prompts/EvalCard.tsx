'use client';

import { useState } from 'react';

import type { PromptDetail } from '@nextkin/shared/models';
import { useEvaluatePrompt, useSavePromptDraft } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { errorMessage, formatScore, formatTime } from '../format';
import { ActionButton, InfoAlert } from '../ui/ContentBits';
import { formatPromptDay } from './promptDates';

/**
 * The draft's eval (Figma 407:3141): the overall score against the stage's threshold, how the live
 * version did on the same set, and each check, with any below the threshold flagged. With no eval
 * yet (a new or edited draft), it offers to run one. A result is shown only under the version it
 * belongs to.
 */
export function EvalCard({ detail }: { detail: PromptDetail }) {
  const version = detail.draft?.version ?? detail.activeVersion;
  const result = detail.eval?.version === version ? detail.eval : null;
  // The live version's score from its last eval, when the per-check results aren't held here.
  const recorded = detail.versions.find((v) => v.version === version)?.evalScore ?? null;
  const evaluate = useEvaluatePrompt(detail.name);

  return (
    <AdminCard
      icon="ClipboardCheck"
      title={`Eval · v${version}${detail.draft ? ' draft' : ''}`}
      trailing={
        result && (
          <span className="text-caption-m font-normal text-text-tertiary">
            {formatPromptDay(result.at, false)}, {formatTime(result.at)}
          </span>
        )
      }
      bodyClassName="gap-4"
    >
      {evaluate.isPending ? (
        <div
          className="flex flex-col items-center gap-2 py-8 text-body-s text-text-secondary"
          aria-live="polite"
        >
          <AdminIcon name="Hourglass01" className="text-brand-600" />
          Running {detail.stage ? `the ${detail.stage.evalSet} set` : 'the eval'}…
        </div>
      ) : !result ? (
        <div className="flex flex-col items-center gap-3">
          {detail.draft ? (
            <CardEmpty
              title="Not evaluated yet"
              message={`v${version} needs a passing eval before it can be published.`}
            />
          ) : (
            <CardEmpty
              title="No eval details here"
              message={
                recorded === null
                  ? `v${version} has no eval on record. Run one to see each check.`
                  : `v${version} scored ${formatScore(recorded)} on its last eval. Run it again to see each check.`
              }
            />
          )}
          <ActionButton
            variant="primary"
            icon="Play"
            onClick={() =>
              evaluate.mutate(version, {
                onSuccess: (r) =>
                  showToast(
                    r.passed
                      ? `v${version} passed · ${formatScore(r.score)}`
                      : `v${version} scored ${formatScore(r.score)}, below ${formatScore(r.threshold)}`,
                    { tone: r.passed ? 'success' : 'error' },
                  ),
                onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
              })
            }
          >
            Run eval
          </ActionButton>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <p className="animate-reveal text-display-l font-semibold tracking-[-0.015em] tabular-nums text-text-primary">
                {formatScore(result.score)}
              </p>
              <AdminBadge
                tone={result.passed ? 'success' : 'danger'}
                icon={<AdminIcon name={result.passed ? 'Check' : 'AlertTriangle'} size="xs" />}
              >
                {result.passed ? 'Passed' : 'Below'} · threshold {formatScore(result.threshold)}
              </AdminBadge>
            </div>
            <p className="text-body-s text-text-secondary">
              {result.cases} seeded cases
              {result.baseline &&
                ` · v${result.baseline.version} scored ${formatScore(result.baseline.score)} on the same set`}
            </p>
          </div>
          <ul className="flex flex-col gap-3.5 border-t border-neutral-100 pt-4">
            {result.checks.map((check) => {
              const below = check.score < check.threshold;
              return (
                <li key={check.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-body-s">
                    <span className="flex-1 font-medium text-neutral-700">{check.label}</span>
                    {below && (
                      <AdminBadge tone="warning">below {formatScore(check.threshold)}</AdminBadge>
                    )}
                    <span className="font-semibold tabular-nums text-text-primary">
                      {formatScore(check.score)}
                    </span>
                  </div>
                  <div
                    role="meter"
                    aria-label={check.label}
                    aria-valuemin={0}
                    aria-valuemax={1}
                    aria-valuenow={check.score}
                    className="h-1.5 overflow-hidden rounded-full bg-neutral-100"
                  >
                    <span
                      style={{ width: `${check.score * 100}%` }}
                      className={cn(
                        'block h-full animate-meter-grow rounded-full',
                        below ? 'bg-warning-600' : 'bg-success-600',
                      )}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AdminCard>
  );
}

export function PublishGateAlert() {
  return (
    <InfoAlert icon="Lock01">
      Publishing is blocked until a draft passes evals. Rollback is instant.
    </InfoAlert>
  );
}

/** What changed and why, saved with the publish and written to the audit log (407:3141). */
export function ChangeNoteCard({ detail }: { detail: PromptDetail }) {
  const [note, setNote] = useState(detail.changeNote);
  const save = useSavePromptDraft(detail.name);
  return (
    <AdminCard icon="Edit03" title="Change note" bodyClassName="gap-3">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => {
          if (note === detail.changeNote) return;
          save.mutate(
            { note },
            { onError: (error) => showToast(errorMessage(error), { tone: 'error' }) },
          );
        }}
        aria-label="Change note"
        placeholder="What changed and why"
        disabled={!detail.draft}
        className="min-h-[116px] w-full resize-y rounded-sm border border-neutral-300 bg-surface-card px-3.5 py-2.5 text-body-m text-text-primary shadow-xs outline-none transition-[border-color,box-shadow] duration-fast focus:border-border-selected focus:ring-4 focus:ring-brand-100 disabled:bg-neutral-50 disabled:text-text-tertiary"
      />
      <p className="text-caption-m font-normal text-text-secondary">
        {detail.draft
          ? 'Saved with the publish and written to the audit log.'
          : 'Open a draft to write its change note.'}
      </p>
    </AdminCard>
  );
}
