import { cn } from '@/lib/cn';

import { Stars02, iconSize } from './lineIcons';

export type AiLoaderVariant = 'shimmer-text' | 'dots' | 'loading-line' | 'pulse-ring';

export type AiLoaderProps = {
  variant?: AiLoaderVariant;
  /** What is happening, in words: shown by `shimmer-text`, read out by the others. */
  text?: string;
  /** Beside its own status text: purely decorative, so nothing is announced twice. */
  silent?: boolean;
  className?: string;
};

/**
 * The AI's "working" states (owner, toreview §132.8), adapted from a shadcn sample to this app's
 * tokens and icons. Use them only where the AI itself is working; ordinary loading keeps
 * `Skeleton` and buttons keep `Spinner`.
 *
 * - `shimmer-text`: a sentence the light runs across ("Reading the job description…").
 * - `dots`: three thinking dots, for a reply on its way in a conversation.
 * - `loading-line`: a hairline with a sweeping light, under something being read.
 * - `pulse-ring`: a ring that draws itself, for a compact wait.
 *
 * Every animation is a theme token, so reduced motion stills them (`theme.css`); each variant
 * carries its words for assistive tech.
 */
export function AiLoader({
  variant = 'shimmer-text',
  text = 'Working…',
  silent = false,
  className,
}: AiLoaderProps) {
  const a11y = silent ? ({ 'aria-hidden': true } as const) : ({ role: 'status' } as const);
  if (variant === 'shimmer-text') {
    return (
      <span {...a11y} className={cn('inline-flex items-center gap-2', className)}>
        <Stars02 aria-hidden className={cn(iconSize.sm, 'animate-pulse text-text-brand')} />
        <span className="animate-shimmer bg-linear-to-r from-text-tertiary via-text-primary to-text-tertiary bg-size-[200%_auto] bg-clip-text font-medium text-transparent">
          {text}
        </span>
      </span>
    );
  }

  if (variant === 'dots') {
    return (
      <span
        {...a11y}
        className={cn(
          'inline-flex w-fit items-center gap-1.5 rounded-full border border-border-subtle bg-surface-muted px-4 py-2.5',
          className,
        )}
      >
        <span aria-hidden className="size-2 animate-think rounded-full bg-brand-600" />
        <span
          aria-hidden
          className="size-2 animate-think rounded-full bg-brand-600 [animation-delay:var(--transition-duration-fast)]"
        />
        <span
          aria-hidden
          className="size-2 animate-think rounded-full bg-brand-600 [animation-delay:calc(var(--transition-duration-fast)*2)]"
        />
        {!silent && <span className="sr-only">{text}</span>}
      </span>
    );
  }

  if (variant === 'loading-line') {
    return (
      <span
        {...a11y}
        className={cn(
          'relative block h-[3px] w-full overflow-hidden rounded-full bg-neutral-200/70',
          className,
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1/2 animate-sweep bg-linear-to-r from-transparent via-brand-600 to-transparent"
        />
        {!silent && <span className="sr-only">{text}</span>}
      </span>
    );
  }

  return (
    <span
      {...a11y}
      className={cn('relative inline-flex size-8 items-center justify-center', className)}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full border-[3px] border-neutral-200/70"
      />
      <svg aria-hidden viewBox="0 0 50 50" className="size-full animate-spin">
        <circle
          cx="25"
          cy="25"
          r="20"
          strokeLinecap="round"
          className="animate-ring-draw fill-none stroke-brand-600 stroke-[4]"
        />
      </svg>
      {!silent && <span className="sr-only">{text}</span>}
    </span>
  );
}
