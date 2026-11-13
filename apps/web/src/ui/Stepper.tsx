import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Check } from '@/ui/lineIcons';

/**
 * A flow's steps (738:30), promoted to a primitive (redesign R3d): done ones ticked, the current
 * one filled, the rest grey, joined by lines that fill as you go. Labels say what the user does
 * ("Choose the job", "Pick keywords", "Review"), not what the system does. `step` past the last
 * ticks them all. Screen readers hear each step's state, and the current one carries
 * `aria-current="step"`. A done step with an address in `hrefs` is a link back to it (owner,
 * 2026-11-14: "clicking on any steps should move me to that").
 */
export function Stepper({
  steps,
  step,
  label = 'Steps',
  hrefs,
}: {
  steps: readonly string[];
  /** The current step, from 0. */
  step: number;
  /** What the list is called for screen readers. */
  label?: string;
  /** Where each step lives; a done step with one becomes a link back to it. */
  hrefs?: readonly (Route | undefined)[];
}) {
  return (
    <ol aria-label={label} className="flex items-center gap-2">
      {steps.map((label, index) => {
        const done = index < step;
        const current = index === step;
        const href = done ? hrefs?.[index] : undefined;
        const Pill = href ? Link : 'span';
        return (
          <li key={label} className="flex items-center gap-2">
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  'h-px w-5 transition-colors duration-base ease-standard',
                  index <= step ? 'bg-border-brand-strong' : 'bg-border-default',
                )}
              />
            )}
            <Pill
              href={href as Route}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex h-8 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-body-s font-medium transition-colors duration-base ease-standard',
                // Below 640 only the current step keeps its words, so the row fits a phone.
                !current && 'max-sm:pr-1',
                current
                  ? 'bg-surface-card font-semibold text-text-primary shadow-card ring-1 ring-border-subtle'
                  : done
                    ? 'bg-brand-50 text-text-brand'
                    : 'bg-surface-muted text-text-tertiary',
                href &&
                  'hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-micro font-semibold transition-colors duration-base ease-standard',
                  current
                    ? 'bg-action-primary text-text-on-brand'
                    : done
                      ? 'bg-brand-100 text-text-brand'
                      : 'bg-surface-card text-text-tertiary',
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className={current ? undefined : 'max-sm:sr-only'}>{label}</span>
              <span className="sr-only">{done ? ', done' : current ? ', current step' : ''}</span>
            </Pill>
          </li>
        );
      })}
    </ol>
  );
}
