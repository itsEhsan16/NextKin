import { cn } from '@/lib/cn';

export type ProgressBarProps = {
  value: number;
  label: string;
  className?: string;
  /**
   * Grow from nothing as it mounts — `useReveal`'s answer, so a bar arriving with its data fills
   * in while a cached one just shows (`toreview.md` §85).
   */
  sweep?: boolean;
  /** The fill's colour and corners where a board draws them otherwise: Insights' bars. */
  fillClassName?: string;
};

/** 0–1 completeness meter (286:612). Announced as a progressbar for §8.7. */
export function ProgressBar({
  value,
  label,
  className,
  sweep = false,
  fillClassName,
}: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-progress w-full overflow-hidden rounded-full bg-neutral-200', className)}
    >
      <div
        className={cn(
          'h-full rounded-full bg-brand-600 transition-width duration-meter ease-decelerate',
          sweep && 'animate-meter-grow',
          fillClassName,
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
