import type { ReactNode } from 'react';

import { RunWatcher } from '@/features/tailor/RunWatcher';
import { Sidebar } from '@/navigation/Sidebar';
import { SessionGate } from '@/providers/SessionGate';
import { TopBar } from '@/navigation/TopBar';
import { Toaster } from '@/ui/Toaster';

/**
 * The authenticated shell. The sidebar owns a 240px gutter (72 collapsed). The rest is the
 * app-wide top bar, pinned over the page, and the page itself, laid out by each screen's
 * `pageFrame` (`toreview.md` §16, §28). The toaster sits outside the page so a confirmation
 * outlives the route change that often follows it (`toreview.md` §85).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main id="main">{children}</main>
      </div>
      <Toaster />
      {/* Runs the user left with "Leave and notify me" (toreview §114). */}
      <RunWatcher />
      <SessionGate />
    </div>
  );
}
