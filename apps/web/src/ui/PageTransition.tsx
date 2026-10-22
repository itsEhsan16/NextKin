import * as React from 'react';
import type { ReactNode } from 'react';

/**
 * React's `<ViewTransition>`. The App Router runs Next's bundled React canary, which has it; Jest
 * runs the stable React 19.2 release, which doesn't, so there this is undefined and pages render
 * without it.
 */
const ViewTransition = (React as Partial<typeof React>).ViewTransition;

/**
 * Wraps one page's content so a route change cross-fades (`toreview.md` §84): the page being left
 * fades out over `press` while the arriving one fades in over `fast` (`theme.css`, the
 * `page-exit` / `page-enter` classes). The sidebar and top bar carry their own transition names
 * and stay perfectly still.
 *
 * Every `page.tsx` renders it around its screen, not the `(app)` layout: a layout persists across
 * navigations, so nothing inside it would ever enter or exit (Next's view-transitions guide).
 * Only route changes animate it: `default="none"` keeps it out of every other transition, and the
 * first load isn't a transition at all. Browsers without view transitions swap instantly.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  if (!ViewTransition) return children;
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
