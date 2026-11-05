import { cn } from '@/lib/cn';

/**
 * A share of 100 as the rubric board draws it (408:3388, 409:2536): the filled part and the rest
 * as two 8px segments 2px apart, each rounded on its outer end. Grows by share rather than by a %
 * width, so the gap never pushes the track past its box.
 */
export function ShareBar({
  value,
  label,
  fill = 'bg-brand-600',
  className,
}: {
  /** 0–100. */
  value: number;
  label: string;
  fill?: string;
  className?: string;
}) {
  const share = Math.min(100, Math.max(0, value));
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={share}
      className={cn('flex h-2 gap-0.5 overflow-hidden', className)}
    >
      {share > 0 && (
        <span
          style={{ flexGrow: share, flexBasis: 0 }}
          className={cn(
            'h-full min-w-0 animate-meter-grow rounded-l-full',
            share === 100 && 'rounded-r-full',
            fill,
          )}
        />
      )}
      {share < 100 && (
        <span
          style={{ flexGrow: 100 - share, flexBasis: 0 }}
          className={cn(
            'h-full min-w-0 rounded-r-full bg-neutral-100',
            share === 0 && 'rounded-l-full',
          )}
        />
      )}
    </span>
  );
}
