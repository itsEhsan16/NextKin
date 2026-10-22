import { PlusIcon } from '@/ui/icons';
import { cn } from '@/lib/cn';

/** "Add a role", "Add a school": a dashed brand row under a section's entries (EDIT 01, 866:356). */
export function AddButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-control-md items-center justify-center gap-2 rounded-xl border border-dashed border-border-brand bg-surface-brand text-body-m font-semibold text-text-brand transition-colors duration-press ease-standard hover:border-border-brand-strong hover:bg-surface-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        className,
      )}
    >
      <PlusIcon aria-hidden className="size-3.5" />
      {label}
    </button>
  );
}
