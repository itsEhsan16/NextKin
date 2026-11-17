'use client';

import { qk, useStall } from '@nextkin/shared/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { AlertCircle, CheckCircle, InfoCircle, RefreshCw01, iconSize } from '@/ui/lineIcons';
import { ProgressBar } from '@/ui/ProgressBar';
import { AiOrb } from '@/ui/AiOrb';

import { stepCard, stepShell } from '../jobFlow/FlowChrome';
import type { RunLine } from '../runLines';

/**
 * A run while it works (toreview §125, §231), shared by tailoring and the Quick Start flows. One
 * centred column inside the step's card (owner, 2026-11-17, from their reference): the art on
 * top, a small brand pill, the title and its line, then the meter (what runs and how far), the bar
 * and the run's own steps ticking off, the one being worked on lifted on a brand tint. Under them
 * sit the note and the flow's own way out ("Leave and notify me" for a long write, Cancel for a
 * quick check).
 *
 * A run that stops moving says so (toreview §131): after a minute with no progress the note turns
 * to "taking longer than usual", and after five it offers to check on the run again, which
 * refetches it from the server rather than pretending it is still on its way.
 */
export function RunProgress({
  art,
  eyebrow = 'NextKin',
  title,
  subtitle,
  meter,
  progress,
  lines,
  note,
  action,
}: {
  art: ReactNode;
  /** The pill over the title; the brand by default, as in the owner's reference. */
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  /** "Writing your resume", over the bar. */
  meter: string;
  progress: number;
  lines: readonly RunLine[];
  note: string;
  action?: ReactNode;
}) {
  const percent = Math.round(progress * 100);
  const queryClient = useQueryClient();
  const [checks, setChecks] = useState(0);
  const stall = useStall(progress < 1, `${progress}:${checks}`);
  const checkAgain = () => {
    setChecks((n) => n + 1);
    void queryClient.invalidateQueries({ queryKey: qk.generations.all });
  };
  return (
    <div className={stepShell}>
      <section
        aria-labelledby="run-title"
        className={cn(stepCard, 'flex flex-col items-center px-6 py-10 sm:px-8')}
      >
        <div className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center">
          <div aria-hidden className="flex min-h-40 items-center justify-center">
            {art}
          </div>
          <p className="mt-6 rounded-full bg-surface-brand-tint px-3.5 py-1 text-caption-m font-semibold uppercase tracking-wide text-text-brand">
            {eyebrow}
          </p>
          <h1
            id="run-title"
            className="mt-4 text-center text-h1 font-bold tracking-tight text-text-primary"
          >
            {title}
          </h1>
          {subtitle && (
            <div className="mt-2 max-w-xl break-words text-center text-body-l text-text-secondary">
              {subtitle}
            </div>
          )}

          <div className="mt-8 w-full">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3 text-body-l font-semibold text-text-primary">
                {/* The AI composing while the run works (owner, toreview §132.9). */}
                {progress < 1 && stall !== 'stalled' && <AiOrb state="writing" />}
                <span className="truncate">{meter}</span>
              </span>
              <span className="text-h3 font-bold tabular-nums text-text-brand">{percent}%</span>
            </div>
            <ProgressBar value={progress} label={meter} className="mt-3 h-2.5 bg-brand-50" />
            <ol className="mt-5 flex flex-col gap-1" aria-live="polite">
              {lines.map(({ label, state }) => (
                <li
                  key={label}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-body-l transition-colors duration-base ease-standard',
                    state === 'todo' ? 'text-text-tertiary' : 'text-text-primary',
                    state === 'current' && 'bg-surface-brand-tint font-semibold',
                  )}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    {state === 'done' ? (
                      <CheckCircle
                        aria-hidden
                        className={cn(iconSize.md, 'animate-pop-in text-success-600')}
                      />
                    ) : state === 'current' ? (
                      <AiOrb />
                    ) : (
                      <span
                        aria-hidden
                        className="size-5 rounded-full border-2 border-neutral-200"
                      />
                    )}
                  </span>
                  <span className="min-w-0 break-words">{label}</span>
                  <span className="sr-only">
                    {state === 'done' ? ', done' : state === 'current' ? ', in progress' : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <p
            className={cn(
              'mt-8 flex items-start justify-center gap-2 text-center text-body-m',
              stall === 'stalled' ? 'text-danger-600' : 'text-text-tertiary',
            )}
          >
            {stall === 'stalled' ? (
              <>
                <AlertCircle aria-hidden className={cn(iconSize.sm, 'mt-0.5')} />
                This is taking much longer than it should.
              </>
            ) : (
              <>
                <InfoCircle aria-hidden className={cn(iconSize.sm, 'mt-0.5')} />
                <span role="status">
                  {stall === 'slow'
                    ? 'Taking longer than usual. You can leave; it carries on.'
                    : note}
                </span>
              </>
            )}
          </p>
          {(stall === 'stalled' || action) && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {stall === 'stalled' && (
                <Button
                  variant="secondary"
                  size="lg"
                  icon={<RefreshCw01 aria-hidden className={iconSize.sm} />}
                  onClick={checkAgain}
                >
                  Check again
                </Button>
              )}
              {action}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
