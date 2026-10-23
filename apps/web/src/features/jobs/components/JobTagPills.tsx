import { cn } from '@/lib/cn';

export type JobTagPillsProps = {
  tags: string[];
  /** Show this many, then a "+N" pill for the rest. Omit to show every tag (the Skills tab). */
  max?: number;
  /** `sm` on the list cards (20px tall), `md` in the detail card (24px). */
  size?: 'sm' | 'md';
  className?: string;
};

// The line height rides with each size and after its font size: tailwind-merge drops a `leading-*`
// that precedes a `text-*` role, which once silently made these pills taller than drawn.
const SIZE = {
  sm: 'px-2 py-0.5 text-caption-m leading-4',
  md: 'px-2.5 py-1 text-caption-m leading-4',
} as const;

/** The italic skill pills — one component for the card, the detail card and the Skills tab. */
export function JobTagPills({ tags, max, size = 'sm', className }: JobTagPillsProps) {
  const shown = max != null ? tags.slice(0, max) : tags;
  const overflow = tags.length - shown.length;
  const labels = overflow > 0 ? [...shown, `+${overflow}`] : shown;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {labels.map((label) => (
        <span
          key={label}
          className={cn(
            'rounded-sm bg-surface-muted font-medium italic text-text-secondary',
            SIZE[size],
          )}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
