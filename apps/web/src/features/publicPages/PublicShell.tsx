import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { LogoMarkIllustration } from '@/ui/illustrations';
import { pageColumn } from '@/ui/pageFrame';

/**
 * The frame of a page anyone can open without an account: the privacy policy, the terms and the
 * account-deletion page that Google Play's listing and Data safety form link to. The same bare
 * header the shared report uses (`SharedReportScreen`), with no app shell behind it.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50">
      <main className={cn(pageColumn, 'flex max-w-170 flex-col gap-4 py-8')}>
        <header className="flex items-center justify-between gap-3">
          <Link
            href={'/' as Route}
            className="flex items-center gap-2.5 text-title-l font-bold text-text-primary"
          >
            <LogoMarkIllustration aria-hidden className="h-7 w-auto" />
            NextKin
          </Link>
          <nav className="flex gap-4 text-body-m text-text-secondary">
            <Link href={'/legal/privacy' as Route} className="hover:underline">
              Privacy
            </Link>
            <Link href={'/legal/terms' as Route} className="hover:underline">
              Terms
            </Link>
          </nav>
        </header>
        {children}
      </main>
    </div>
  );
}
