'use client';

import { qk, useStall } from '@nextkin/shared/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { cardSurface } from '@/ui/Card';
import { AlertCircle, CheckCircle, InfoCircle, RefreshCw01, iconSize } from '@/ui/lineIcons';
import { ProgressBar } from '@/ui/ProgressBar';
import { AiOrb } from '@/ui/AiOrb';

import type { RunLine } from '../runLines';

/**
 * A run while it works (toreview §125), shared by tailoring and the Quick Start flows: the art,
 * what is being made, the bar, and the run's own steps ticking off. The action under it is the
 * flow's own: "Leave and notify me" for a long write, Cancel for a quick check.
 *
 * A run that stops moving says so (toreview §131): after a minute with no progress the note turns
 * to "taking longer than usual", and after five it offers to check on the run again, which
 * refetches it from the server rather than pretending it is still on its way.
 */
export function RunProgress({
  art,
  eyebrow,
  title,
  subtitle,
  meter,
  progress,
  lines,
  note,
  action,
}: {
  art: ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
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
    <section
      aria-labelledby="run-title"
      className={cn(
        cardSurface,
        'mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-8 text-center shadow-card sm:px-12',
      )}
    >
      {art}
      {eyebrow && (
        <p className="mt-4 text-micro font-semibold uppercase tracking-wide text-text-brand">
          {eyebrow}
        </p>
      )}
      <h1 id="run-title" className="mt-1.5 text-h1 text-text-primary">
        {title}
      </h1>
      {subtitle && <p className="mt-1.5 text-body-m text-text-secondary">{subtitle}</p>}

      <div className="mt-6 w-full text-left">
        <div className="flex items-center justify-between text-body-m">
          <span className="flex items-center gap-2 font-medium text-text-primary">
            {/* The AI composing while the run works (owner, toreview §132.9). */}
            {progress < 1 && stall !== 'stalled' && <AiOrb state="writing" />}
            {meter}
          </span>
          <span className="font-semibold tabular-nums text-text-brand">{percent}%</span>
        </div>
        <ProgressBar value={progress} label={meter} className="mt-2 h-2 bg-neutral-100" />
        <ol className="mt-4 flex flex-col gap-2" aria-live="polite">
          {lines.map(({ label, state }) => (
            <li
              key={label}
              className={cn(
                'flex items-center gap-3 py-1 text-body-m transition-colors duration-base ease-standard',
                state === 'todo' ? 'text-text-tertiary' : 'text-text-primary',
                state === 'current' && 'font-medium',
              )}
            >
              {state === 'done' ? (
                <CheckCircle
                  aria-hidden
                  className={cn(iconSize.sm, 'animate-pop-in text-success-600')}
                />
              ) : state === 'current' ? (
                <AiOrb className="-m-0.5" />
              ) : (
                <span
                  aria-hidden
                  className="size-4 shrink-0 rounded-full border-2 border-neutral-200"
                />
              )}
              {label}
              <span className="sr-only">
                {state === 'done' ? ', done' : state === 'current' ? ', in progress' : ''}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {stall === 'stalled' ? (
        <div role="alert" className="mt-6 flex flex-col items-center gap-3">
          <p className="flex items-center gap-2 text-body-m font-medium text-danger-text">
            <AlertCircle aria-hidden className={iconSize.sm} />
            This is taking much longer than it should.
          </p>
          <Button
            variant="secondary"
            icon={<RefreshCw01 aria-hidden className={iconSize.sm} />}
            onClick={checkAgain}
          >
            Check again
          </Button>
        </div>
      ) : (
        <p role="status" className="mt-6 flex items-center gap-2 text-body-s text-text-tertiary">
          <InfoCircle aria-hidden className={iconSize.sm} />
          {stall === 'slow' ? 'Taking longer than usual. You can leave; it carries on.' : note}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
