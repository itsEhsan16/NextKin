import { cn } from '@/lib/cn';
import { brandOutlineButton } from '@/ui/brandOutlineButton';
import { Soon, soonControl } from '@/ui/Soon';

export type CardActionProps = {
  label: string;
  /** A fuller name where the label alone is ambiguous: "Edit" → "Edit account information". */
  accessibleName?: string;
  /** What it does, where a board draws something behind it: Job preferences' Edit and Done. */
  onClick?: () => void;
};

/**
 * The outlined action at a Settings card's top right: "Edit", "Change password", "Enable",
 * "View all" (254:493, 532, 549, 565), and Job preferences' "Edit" (356:20). Only that last one
 * has anything behind it: it unlocks its card. The rest wait for their forms and lists, and are
 * inert until those are drawn (`toreview.md` §21, §22).
 */
export function CardAction({ label, accessibleName, onClick }: CardActionProps) {
  const button = (
    <button
      type="button"
      aria-label={accessibleName}
      aria-disabled={onClick ? undefined : true}
      onClick={onClick}
      className={cn(
        brandOutlineButton,
        'h-control-sm min-w-19 shrink-0 rounded-sm px-3 text-body-s font-semibold',
        soonControl,
      )}
    >
      {label}
    </button>
  );
  // One with nothing behind it yet says so, rather than looking live (`toreview.md` §102).
  return onClick ? button : <Soon>{button}</Soon>;
}
