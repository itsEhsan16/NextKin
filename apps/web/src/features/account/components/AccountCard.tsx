import { useId, type ComponentType, type ReactNode, type SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { cardPad, cardSurface } from '@/ui/Card';
import { EditIcon } from '@/ui/icons';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

export type AccountCardProps = {
  title: string;
  /** The line under the title: Profile information's "This information is used across…". */
  description?: string;
  /** The glyph before the title (307:3571, 307:3586, 307:3654). */
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * Sets the glyph in a lavender square beside the title and its line, rather than inline before
   * the title: how the Settings board draws its cards (254:486).
   */
  tile?: boolean;
  /**
   * A duotone glyph beside the title and its line, on no tile: how the redrawn Settings → Account
   * board draws its cards (356:357). Takes the place of `Icon` and `tile`.
   */
  Art?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Draws the card's "Edit" (307:3519). */
  editable?: boolean;
  /** A labelled action on the right instead, as the Settings cards draw theirs (254:493). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * One of the Account page's cards (307:3512, 3568, 3583, 3651), and of the Settings page's
 * (254:483, 522, 539, 555): a title, sometimes a glyph and a line under it, and an action on the
 * right. No board draws an edit form, so Edit is inert, like the kebabs elsewhere, until one is
 * (`toreview.md` §20, §21).
 */
export function AccountCard({
  title,
  description,
  Icon,
  tile,
  Art,
  editable,
  action,
  children,
  className,
}: AccountCardProps) {
  const titleId = useId();

  const heading = (
    <div className="min-w-0">
      <h2 id={titleId} className="flex items-center gap-2.5 text-title-l text-text-primary">
        {Icon && !tile && <Icon className="size-5 shrink-0 text-brand-600" />}
        {title}
      </h2>
      {description && <p className="mt-1 text-body-s text-text-tertiary">{description}</p>}
    </div>
  );

  return (
    <section aria-labelledby={titleId} className={cn(cardSurface, cardPad, className)}>
      <div className="flex items-start justify-between gap-4">
        {Art ? (
          <div className="flex min-w-0 items-center gap-4">
            <span aria-hidden className="flex w-10 shrink-0 justify-center">
              <Art className="h-auto max-h-8 w-10" />
            </span>
            {heading}
          </div>
        ) : Icon && tile ? (
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-brand-strong">
              <Icon className="size-5 text-brand-600" />
            </span>
            {heading}
          </div>
        ) : (
          heading
        )}
        {editable && (
          <button
            type="button"
            aria-label={`Edit ${title.toLowerCase()}`}
            className={cn(
              BUTTON_VARIANT['brand-secondary'],
              'h-control-sm shrink-0 gap-1.5 rounded-md px-3.5 text-body-s font-semibold',
            )}
          >
            <EditIcon className="size-3.5" />
            Edit
          </button>
        )}
        {action}
      </div>
      {children}
    </section>
  );
}
