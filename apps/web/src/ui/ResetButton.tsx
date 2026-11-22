import { cn } from '@/lib/cn';
import { pressable } from '@/ui/pressable';

/**
 * "Reset" at the end of a filter row (286:1300, 304:3119): brand text, no frame, following the
 * last chip (owner, 2026-11-13, Applications). Every list shows it only once something is narrowed,
 * and it clears the chips and the search (toreview §254).
 */
export function ResetButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'ml-1 flex h-control-sm shrink-0 items-center rounded-sm px-1 text-caption-m font-semibold text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        pressable,
        className,
      )}
    >
      Reset
    </button>
  );
}
