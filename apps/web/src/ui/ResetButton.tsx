import { cn } from '@/lib/cn';
import { pressable } from '@/ui/pressable';

/**
 * "Reset" at the end of a filter row (286:1300, 304:3119): brand text, no frame, level with the
 * row's first line.
 */
export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'ml-auto flex h-control-sm shrink-0 items-center rounded-sm px-1 text-caption-m font-semibold text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        pressable,
      )}
    >
      Reset
    </button>
  );
}
