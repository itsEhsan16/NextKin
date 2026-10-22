import type { Route } from 'next';
import type { ComponentType, SVGProps } from 'react';

import {
  NavAiAssistantIllustration,
  NavApplicationsIllustration,
  NavDocumentsIllustration,
  NavHelpIllustration,
  NavHomeIllustration,
  NavInsightsIllustration,
  NavInterviewPrepIllustration,
  NavJobsIllustration,
  NavResumesIllustration,
  NavSettingsIllustration,
} from '@/ui/illustrations';

export type NavBadge = 'applications' | 'documents';

export type NavItem = {
  key: string;
  label: string;
  href: Route;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Which live count sits on the right of the row, if any. */
  badge?: NavBadge;
};

/**
 * The eight authenticated destinations, in the order the sidebar draws them (Figma 304:497).
 * The glyphs are the duotone set from the NEXKTKIN-PVT sidebar (711:2), which keep their own
 * palette, so they come from the illustrations pipeline rather than the single-ink icons.
 *
 * Worth noting against the spec: V2 never enumerates a navigation. §9.1 names "dashboard, resume
 * library, profile, job board, skills explorer" as the read surfaces and §7.2 lists the dashboard
 * tiles, but Applications, Documents and Insights come from this board alone — application
 * tracking is named as a Release 2 capability in §17.1. They are carried here because the board
 * draws them; see `toreview.md`.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'home', label: 'Home', href: '/' as Route, Icon: NavHomeIllustration },
  { key: 'jobs', label: 'Jobs', href: '/jobs' as Route, Icon: NavJobsIllustration },
  {
    key: 'applications',
    label: 'Applications',
    href: '/applications' as Route,
    Icon: NavApplicationsIllustration,
    badge: 'applications',
  },
  { key: 'resumes', label: 'Resumes', href: '/resumes' as Route, Icon: NavResumesIllustration },
  {
    key: 'documents',
    label: 'Documents',
    href: '/documents' as Route,
    Icon: NavDocumentsIllustration,
    badge: 'documents',
  },
  {
    key: 'interview',
    label: 'Interview Prep',
    href: '/interview' as Route,
    Icon: NavInterviewPrepIllustration,
  },
  { key: 'insights', label: 'Insights', href: '/insights' as Route, Icon: NavInsightsIllustration },
  {
    key: 'assistant',
    label: 'AI Assistant',
    href: '/assistant' as Route,
    Icon: NavAiAssistantIllustration,
  },
];

/**
 * The footer group, below the upgrade card and a divider. Settings opens its own page (254:326);
 * the header avatar and the user chip open the Account page (307:3443).
 */
export const NAV_FOOTER_ITEMS: readonly NavItem[] = [
  { key: 'settings', label: 'Settings', href: '/settings' as Route, Icon: NavSettingsIllustration },
  { key: 'help', label: 'Help & support', href: '/help' as Route, Icon: NavHelpIllustration },
];

/**
 * Whether a nav row should read as current for the given path. Home is exact — every other
 * destination owns its subtree, so `/jobs/abc` still lights up "Jobs".
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  // A job description's own page (toreview §110) is a job page: Jobs stays lit.
  if (href === '/jobs' && pathname.startsWith('/jd/')) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A click whose navigation hasn't landed yet: where it's headed, and the path it left from. */
export type PendingNav = { href: string; from: string };

/**
 * The path the sidebar lights up. Next only moves `usePathname` once the new route has loaded
 * (which in dev includes compiling it on first visit), so a clicked row would otherwise stay dark
 * until then. A pending click wins while the pathname is still the one it left from; once the
 * pathname moves — the navigation landed, or Back/Forward went somewhere else — it no longer
 * describes the page, and is ignored.
 */
export function resolveActivePath(pathname: string, pending: PendingNav | null): string {
  return pending !== null && pending.from === pathname ? pending.href : pathname;
}

/** Where the current row sits in `items` for `path`, or -1 when none of them is current. */
export function activeIndex(items: readonly NavItem[], path: string): number {
  return items.findIndex((item) => isNavItemActive(item.href, path));
}
