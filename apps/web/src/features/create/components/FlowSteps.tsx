import { cn } from '@/lib/cn';
import { Check } from '@/ui/lineIcons';

/**
 * A flow's three steps (738:30): done ones ticked, the current one filled, the rest grey, joined by
 * lines that fill as you go. Tailoring's header and the Quick Start flows share it (toreview §125);
 * `step` past the last ticks them all, as ZERO 05 draws once the checks are done.
 */
export function FlowSteps({ steps, step }: { steps: readonly string[]; step: number }) {
  return (
    <ol aria-label="Steps" className="flex items-center gap-2">
      {steps.map((label, index) => {
        const done = index < step;
        const current = index === step;
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
            <span
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex h-8 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-body-s font-medium transition-colors duration-base ease-standard',
                current
                  ? 'bg-surface-card font-semibold text-text-primary shadow-card ring-1 ring-border-subtle'
                  : done
                    ? 'bg-brand-50 text-text-brand'
                    : 'bg-surface-muted text-text-tertiary',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-micro font-semibold transition-colors duration-base ease-standard',
                  current
                    ? 'bg-brand-600 text-text-inverse'
                    : done
                      ? 'bg-brand-100 text-text-brand'
                      : 'bg-surface-card text-text-tertiary',
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              {label}
              <span className="sr-only">{done ? ', done' : current ? ', current step' : ''}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
