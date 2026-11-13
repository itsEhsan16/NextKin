import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type AdminPageProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** The header's right side, bottom-aligned with the title: a range picker, Export, a primary action. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Every admin page's frame and header (shell template, Figma 401:1548): 32px in from the top bar
 * and the sides, the title at 30/38 SemiBold with -1.5% tracking, the line under it at 16/24, and
 * the actions to the right. The page's sections follow 24px apart.
 */
export function AdminPage({ title, subtitle, actions, children, className }: AdminPageProps) {
  return (
    <div className={cn('flex flex-col gap-6 px-8 pb-10 pt-8', className)}>
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-display-l font-semibold tracking-display text-text-primary">
            {title}
          </h1>
          {subtitle != null && (
            <p className="text-title-l font-normal tracking-normal text-text-secondary">
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
