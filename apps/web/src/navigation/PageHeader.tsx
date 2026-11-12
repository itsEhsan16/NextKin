import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type PageHeaderProps = {
  /** The line above the title — Home's greeting (or its loading skeleton), Jobs' "Jobs". */
  eyebrow?: ReactNode;
  /** The page's name; a skeleton while a page named by its data loads (the document viewer). */
  title: ReactNode;
  /** The line under the title. A page whose board draws a title alone (the AI Assistant) omits it. */
  subtitle?: ReactNode;
  /**
   * What sits to the title's right, bottom-aligned with it: Insights' art and range picker
   * (`toreview.md` §102). The text keeps the column's left; the aside takes what it needs.
   */
  aside?: ReactNode;
  /** Classes for the block: Settings keeps its text out of the corner its character takes. */
  className?: string;
};

/**
 * The top of every page's content: the eyebrow, the title and the line under it, a ~78px block at
 * the compact density (`toreview.md` §16). The app-wide actions (search, Upload New JD,
 * notifications, avatar) are not part of it. They are the layout's `TopBar`, pinned above every
 * page (`toreview.md` §28).
 */
export function PageHeader({ eyebrow, title, subtitle, aside, className }: PageHeaderProps) {
  const text = (
    <>
      {eyebrow != null && <div className="text-body-m text-text-secondary">{eyebrow}</div>}
      {/* One step smaller on a phone, where the full size took two lines (redesign R4, SH-14). */}
      <h1 className="mt-1 text-h1 text-text-primary sm:text-display-l">{title}</h1>
      {subtitle != null && <p className="mt-1.5 text-body-l text-text-secondary">{subtitle}</p>}
    </>
  );

  if (aside == null) return <header className={cn('flex flex-col', className)}>{text}</header>;

  return (
    <header className={cn('flex items-end gap-6', className)}>
      <div className="flex min-w-0 flex-1 flex-col">{text}</div>
      {aside}
    </header>
  );
}
