'use client';

import { qk, useStall } from '@nextkin/shared/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { FlowFooter } from '@/ui/FlowFooter';
import { AlertCircle, CheckCircle, RefreshCw01, iconSize } from '@/ui/lineIcons';
import { ProgressBar } from '@/ui/ProgressBar';
import { AiOrb } from '@/ui/AiOrb';

import { stepCard, stepShell } from '../jobFlow/FlowChrome';
import type { RunLine } from '../runLines';

/**
 * A run while it works (toreview §125), shared by tailoring and the Quick Start flows. It is a
 * step like the ones before it (owner, 2026-11-15: the narrow centred card did not match them):
 * the same card with the step's heading, the bar and the run's own steps ticking off on the left,
 * the art beside them, and the same footer bar under it, holding the note and the flow's own way
 * out ("Leave and notify me" for a long write, Cancel for a quick check).
 *
 * A run that stops moving says so (toreview §131): after a minute with no progress the note turns
 * to "taking longer than usual", and after five it offers to check on the run again, which
 * refetches it from the server rather than pretending it is still on its way.
 */
export function RunProgress({
  art,
  eyebrow,
  step,
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
  /** Where this run sits in its flow: "Step 3 of 3", in place of `eyebrow`. */
  step?: { n: number; of: number };
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
  const kicker = step ? `Step ${step.n} of ${step.of}` : eyebrow;
  return (
    <div className={stepShell}>
      <section
        aria-labelledby="run-title"
        className={cn(stepCard, '@container flex flex-col gap-8 p-8')}
      >
        <div className="flex min-w-0 flex-col gap-2">
          {kicker && (
            <p className="text-caption-m font-semibold uppercase tracking-wide text-text-brand">
              {kicker}
            </p>
          )}
          <h1 id="run-title" className="text-h1 font-bold tracking-tight text-text-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="max-w-prose break-words text-body-l text-text-secondary">{subtitle}</p>
          )}
        </div>

        <div className="grid flex-1 content-center items-center gap-8 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-body-m">
              <span className="flex min-w-0 items-center gap-2 font-medium text-text-primary">
                {/* The AI composing while the run works (owner, toreview §132.9). */}
                {progress < 1 && stall !== 'stalled' && <AiOrb state="writing" />}
                <span className="truncate">{meter}</span>
              </span>
              <span className="font-semibold tabular-nums text-text-brand">{percent}%</span>
            </div>
            <ProgressBar value={progress} label={meter} className="mt-2 h-2 bg-neutral-100" />
            <ol className="mt-5 flex flex-col gap-1" aria-live="polite">
              {lines.map(({ label, state }) => (
                <li
                  key={label}
                  className={cn(
                    'flex items-start gap-3 py-1.5 text-body-m transition-colors duration-base ease-standard',
                    state === 'todo' ? 'text-text-tertiary' : 'text-text-primary',
                    state === 'current' && 'font-medium',
                  )}
                >
                  <span className="flex h-5 w-4 shrink-0 items-center justify-center">
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
                        className="size-4 rounded-full border-2 border-neutral-200"
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
          <div
            aria-hidden
            className="flex items-center justify-center rounded-xl bg-neutral-50 px-6 py-8"
          >
            {art}
          </div>
        </div>
      </section>

      <FlowFooter
        noteTone={stall === 'stalled' ? 'danger' : 'neutral'}
        noteIcon={stall !== 'stalled'}
        note={
          stall === 'stalled' ? (
            <>
              <AlertCircle aria-hidden className={cn(iconSize.sm, 'shrink-0')} />
              This is taking much longer than it should.
            </>
          ) : (
            <span role="status">
              {stall === 'slow' ? 'Taking longer than usual. You can leave; it carries on.' : note}
            </span>
          )
        }
      >
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
      </FlowFooter>
    </div>
  );
}
