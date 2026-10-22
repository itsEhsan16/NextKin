import { useId, type ComponentType, type ReactNode, type SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { brandOutlineButton } from '@/ui/brandOutlineButton';
import { ArrowRightIcon, EditIcon } from '@/ui/icons';
import { pressable } from '@/ui/pressable';
import { cardSurface } from '@/ui/Card';
import { Soon, soonControl } from '@/ui/Soon';

export type ProfileCardProps = {
  title: string;
  /** The duotone glyph before the title (476:648, 667, 718, 878, 913, 1017). */
  Art?: ComponentType<SVGProps<SVGSVGElement>>;
  /** The line under the title: Profile information's "This information is used across…". */
  description?: string;
  /**
   * The header's action: "Edit" (476:658), inert until there is an edit form, as Account's was
   * (`toreview.md` §20); or "View all" (476:691), which opens the card's own tab.
   */
  action?: { kind: 'edit' } | { kind: 'viewAll'; onClick: () => void };
  children: ReactNode;
  className?: string;
};

/**
 * One of the Profile page's cards (476:645-1014): a duotone glyph and a title on the left, Edit
 * or View all on the right, and the section under them.
 */
export function ProfileCard({
  title,
  Art,
  description,
  action,
  children,
  className,
}: ProfileCardProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={cn(cardSurface, 'p-5', className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 id={titleId} className="flex items-center gap-2.5 text-h2 text-text-primary">
            {Art && <Art aria-hidden className="h-auto w-8.5 shrink-0" />}
            {title}
          </h2>
          {description && <p className="mt-1 text-body-m text-text-tertiary">{description}</p>}
        </div>
        {action?.kind === 'edit' && (
          <Soon>
            <button
              aria-disabled="true"
              type="button"
              aria-label={`Edit ${title.toLowerCase()}`}
              className={cn(
                soonControl,
                brandOutlineButton,
                'h-control-sm shrink-0 gap-1.5 self-start rounded-md px-3 text-body-m font-bold',
              )}
            >
              <EditIcon className="size-3.5" />
              Edit
            </button>
          </Soon>
        )}
        {action?.kind === 'viewAll' && (
          <button
            type="button"
            onClick={action.onClick}
            aria-label={`View all ${title.toLowerCase()}`}
            className={cn(
              'flex h-control-sm shrink-0 items-center gap-1.5 rounded-md bg-surface-brand px-3 text-body-m font-bold text-brand-600 hover:bg-surface-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              pressable,
            )}
          >
            View all
            <ArrowRightIcon className="size-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** The full-width lavender-edged action under a list: "Manage experience" (476:712). */
export const cardFooterAction = cn(
  brandOutlineButton,
  'mt-4 h-control-lg w-full gap-2 rounded-md text-body-l font-bold',
);
