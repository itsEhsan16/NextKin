import { cn } from '@/lib/cn';
import { JobAiSparkleIllustration } from '@/ui/illustrations';
import { pressable } from '@/ui/pressable';

import { PROMPTS } from '../assistantLibrary';

/**
 * "Try asking" (771:29 on the welcome, 771:2 under a conversation): each chip asks its question.
 * Centred under the welcome, left-aligned under a transcript, as the boards set them.
 */
export function PromptChips({
  onAsk,
  disabled,
  align = 'start',
}: {
  onAsk: (prompt: string) => void;
  disabled: boolean;
  align?: 'start' | 'center';
}) {
  return (
    <section
      aria-labelledby="try-asking"
      className={cn('flex flex-col gap-2.5', align === 'center' && 'items-center')}
    >
      <h2
        id="try-asking"
        className={cn(
          'text-body-m font-semibold',
          align === 'center' ? 'text-text-primary' : 'text-text-secondary',
        )}
      >
        Try asking
      </h2>
      {/* Under the welcome the four sit two by two across the canvas, so they always take two
          rows, whatever the window (`toreview.md` §100). */}
      <ul
        className={cn(
          align === 'center'
            ? 'grid grid-cols-[repeat(2,auto)] justify-center gap-2.5'
            : 'flex flex-wrap gap-2',
        )}
      >
        {PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAsk(prompt)}
              className={cn(
                pressable,
                'flex h-control-md items-center gap-2 rounded-full',
                align === 'center' && 'w-full justify-center whitespace-nowrap',
                'border border-border-brand bg-surface-brand pl-3 pr-3.5 text-body-m font-medium text-neutral-700',
                'not-disabled:hover:border-border-brand-strong not-disabled:hover:bg-surface-brand-strong disabled:opacity-60',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              )}
            >
              <JobAiSparkleIllustration aria-hidden className="h-auto w-[15px] shrink-0" />
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
