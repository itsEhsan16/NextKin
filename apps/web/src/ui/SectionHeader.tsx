import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';

/**
 * "Top Job Matches … View all" (286:325, 286:599, 286:730). The link is withheld when there is
 * nothing to view, which is the rule the mobile `SectionHeader` follows too.
 *
 * The title is Title/L and the action Body/S SemiBold (15 and 12 at the compact density) — not
 * an H2, which made every section shout over its own content. Every Home section title goes
 * through here, Quick Start included.
 */
export type SectionHeaderProps = {
  title: string;
  actionHref?: Route;
  actionLabel?: string;
  /** Controls set before the action: Top Job Matches' previous and next. */
  controls?: ReactNode;
};

export function SectionHeader({
  title,
  actionHref,
  actionLabel = 'View all',
  controls,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-title-l font-semibold text-text-primary">{title}</h2>
      <div className="flex items-center gap-3">
        {controls}
        {actionHref && (
          <Link
            href={actionHref}
            className="rounded-sm text-body-s font-semibold text-text-brand transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
