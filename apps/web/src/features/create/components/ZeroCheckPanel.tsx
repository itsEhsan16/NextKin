'use client';

import {
  isBlank,
  nextZeroCheck,
  zeroProgress,
  zeroSummary,
  ZERO_CHECK_GROUP_LABEL,
  type ResumeContent,
  type ZeroResolution,
} from '@nextkin/shared/models';
import { useResolveZeroCheck } from '@nextkin/shared/queries';
import Link from 'next/link';
import { useState } from 'react';

import { primaryButton, backButton, stepCard } from '@/features/create/jobFlow/FlowChrome';
import { DownloadPrompts } from '@/features/resumes/components/DownloadPrompts';
import { resumeEditorHref } from '@/features/resumes/resumeHref';
import { useConfirmedDownload } from '@/features/resumes/useConfirmedDownload';
import { cn } from '@/lib/cn';
import { CheckCircle, Download01, Edit03 } from '@/ui/lineIcons';
import { StableLabel } from '@/ui/StableLabel';

import { EducationCheckForm, RoleCheckForm, SkillCheckForm } from './ZeroCheckForms';

const SAVE_FAILED = "We couldn't save that. Check your connection and try again.";

type Row = { key: string; label: string; value: string; state: 'done' | 'current' | 'todo' };

/** Every guess in the draft, in the order they are asked (`nextZeroCheck`): roles, skills, education. */
function rowsOf(content: ResumeContent, currentKey: string | undefined): Row[] {
  const review = content.review;
  const state = (key: string, done: boolean): Row['state'] =>
    done ? 'done' : key === currentKey ? 'current' : 'todo';
  const roles = content.experience.map((r) => {
    const done = r.needsReview !== true && !isBlank(r.company);
    return {
      key: r.id,
      label: r.title || 'A role',
      value: done ? r.company : 'Waiting',
      state: state(r.id, done),
    };
  });
  const skills = (review?.skills ?? []).map((s) => {
    const pending = review?.pendingSkills.includes(s) ?? false;
    const removed = review?.removedSkills.includes(s) ?? false;
    return {
      key: `skill:${s}`,
      label: s,
      value: pending ? 'Waiting' : removed ? 'Removed' : 'Confirmed',
      state: state(`skill:${s}`, !pending),
    };
  });
  const schools = content.education.map((e) => {
    const done = e.needsReview !== true && !isBlank(e.degree) && !isBlank(e.institution);
    return {
      key: e.id,
      label: isBlank(e.degree) ? 'Your degree' : e.degree,
      value: done ? e.institution : 'Waiting',
      state: state(e.id, done),
    };
  });
  return [...roles, ...skills, ...schools];
}

/**
 * ZERO 03 (861:439), step 3: check what we guessed, one at a time — the progress as one segment per
 * guess, the current guess in a brand card with its answer and Save or Remove, then every guess with
 * where it stands. Once nothing is left, step 4: Edit and Download PDF (the export gate holds until
 * then, V2 §7.9).
 */
export function ZeroCheckPanel({
  resumeId,
  content,
}: {
  resumeId: string;
  content: ResumeContent;
}) {
  const resolve = useResolveZeroCheck(resumeId);
  const download = useConfirmedDownload(resumeId);
  const [error, setError] = useState<string | undefined>();
  const progress = zeroProgress(content);
  const item = nextZeroCheck(content);
  const done = progress.left === 0;
  const currentKey = item
    ? item.kind === 'role'
      ? item.role.id
      : item.kind === 'skill'
        ? `skill:${item.skill}`
        : item.entry.id
    : undefined;
  const rows = rowsOf(content, currentKey);

  const answer = (resolution: ZeroResolution) => {
    setError(undefined);
    resolve.mutate(resolution, {
      onError: (e) => setError(e instanceof Error && e.message ? e.message : SAVE_FAILED),
    });
  };
  const common = { busy: resolve.isPending, error, onResolve: answer };

  return (
    <aside aria-labelledby="zero-check" className={cn(stepCard, 'flex flex-col gap-4 px-6 py-5.5')}>
      <p className="text-micro font-bold uppercase tracking-wider text-text-brand">
        Step {done ? 4 : 3} of 4
      </p>
      <h1 id="zero-check" className="text-h1 font-bold text-text-primary">
        {done
          ? 'Your resume is ready'
          : `Check ${progress.total} ${progress.total === 1 ? 'thing' : 'things'} we guessed`}
      </h1>
      <p className="text-body-l text-text-secondary">
        {done
          ? 'Every guess is checked. It’s yours to edit and download.'
          : 'One at a time. The draft is kept in Resumes; it downloads once every guess is checked.'}
      </p>
      <div
        aria-label={`${progress.checked} of ${progress.total} checked`}
        role="img"
        className="flex gap-1.5"
      >
        {Array.from({ length: Math.max(1, progress.total) }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-base ease-standard',
              i < progress.checked
                ? 'bg-success-600'
                : i === progress.checked && !done
                  ? 'bg-brand-600'
                  : 'bg-neutral-200',
            )}
          />
        ))}
      </div>

      {item && !done && (
        <div
          key={currentKey}
          className="flex animate-reveal flex-col gap-3 rounded-xl border border-brand-600 bg-surface-brand-strong px-4.5 pb-4.5 pt-4 ring-1 ring-brand-600"
        >
          <p className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border-brand-strong bg-surface-card px-2.5 py-0.5 text-caption-m font-semibold text-text-brand">
              Guess {Math.min(progress.total, progress.checked + 1)} of {progress.total}
            </span>
            <span className="text-body-s font-semibold text-text-tertiary">
              {ZERO_CHECK_GROUP_LABEL[item.kind]}
            </span>
          </p>
          {item.kind === 'role' ? (
            <RoleCheckForm role={item.role} {...common} />
          ) : item.kind === 'skill' ? (
            <SkillCheckForm skill={item.skill} {...common} />
          ) : (
            <EducationCheckForm entry={item.entry} {...common} />
          )}
        </div>
      )}

      {done ? (
        <>
          <ul className="flex flex-col gap-2">
            {zeroSummary(content).map((line) => (
              <li key={line} className="flex items-center gap-2.5 text-body-l text-text-primary">
                <CheckCircle aria-hidden className="size-4 shrink-0 text-success-600" />
                {line}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              disabled={download.busy}
              onClick={() => download.start()}
              className={primaryButton}
            >
              <Download01 aria-hidden className="size-4" />
              <StableLabel label="Download PDF" busyLabel="Preparing PDF…" busy={download.busy} />
            </button>
            <Link href={resumeEditorHref(resumeId)} className={backButton}>
              <Edit03 aria-hidden className="mr-2 size-4" />
              Edit resume
            </Link>
          </div>
          {download.blocked && (
            <p role="status" className="text-body-m text-text-secondary">
              {download.blocked}
            </p>
          )}
        </>
      ) : (
        <ul
          aria-label="Every guess"
          className="flex flex-col gap-0.5 rounded-md bg-neutral-50 p-1.5"
        >
          {rows.map((row) => (
            <li
              key={row.key}
              className={cn(
                'flex items-center gap-2.5 rounded-sm px-3.5 py-2.5',
                row.state === 'current' && 'bg-surface-brand-strong',
              )}
            >
              {row.state === 'done' ? (
                <CheckCircle aria-hidden className="size-4.5 shrink-0 text-success-600" />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-full border-2',
                    row.state === 'current' ? 'border-brand-600' : 'border-border-default',
                  )}
                >
                  {row.state === 'current' && (
                    <span className="size-1.5 rounded-full bg-brand-600" />
                  )}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-body-m font-semibold text-text-primary">
                {row.label}
              </span>
              <span
                className={cn(
                  'shrink-0 text-body-s font-medium',
                  row.state === 'done' ? 'text-text-secondary' : 'text-text-tertiary',
                )}
              >
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      )}
      <DownloadPrompts download={download} />
    </aside>
  );
}
