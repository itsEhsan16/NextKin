import { cn } from '@/lib/cn';
import { Check } from '@/ui/lineIcons';

/**
 * A flow's three steps (738:30): done ones ticked, the current one filled, the rest grey, joined by
 * lines that fill as you go. Tailoring's header and the Quick Start flows share it (toreview §125);
 * `step` past the last ticks them all, as ZERO 05 draws once the checks are done.
 */
export function FlowSteps({ steps, step }: { steps: readonly string[]; step: number }) {
  return (
    <ol aria-label="Steps" className="flex items-center gap-2.5">
      {steps.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={label} className="flex items-center gap-2.5">
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  'h-0.5 w-7 rounded-full transition-colors duration-base ease-standard',
                  index <= step ? 'bg-brand-600' : 'bg-neutral-200',
                )}
              />
            )}
            <span
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 text-body-m transition-colors duration-base ease-standard',
                current
                  ? 'font-semibold text-text-primary'
                  : done
                    ? 'text-text-primary'
                    : 'text-text-tertiary',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-micro font-semibold transition-colors duration-base ease-standard',
                  done || current
                    ? 'bg-brand-600 text-text-inverse'
                    : 'bg-neutral-200 text-text-tertiary',
                )}
              >
                {done ? <Check className="size-4" /> : index + 1}
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
