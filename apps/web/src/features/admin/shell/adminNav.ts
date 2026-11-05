import type { Route } from 'next';

import type { AdminPermission, AdminQueueKey } from '@nextkin/shared/models';

import type { AdminIconName } from '@/ui/animated/iconMap';

import type { AdminBadgeTone } from '../ui/AdminBadge';

export type AdminNavItem = {
  key: string;
  label: string;
  href: Route;
  icon: AdminIconName;
  /** What the role needs to open the page; `null` for every staff member. */
  permission: AdminPermission | null;
  /** The queue whose count sits on the row, and the badge's tone. */
  badge?: { queue: AdminQueueKey; tone: AdminBadgeTone };
  /** Built in this slice; the rest open "coming soon" until their boards are built. */
  built?: boolean;
};

export type AdminNavGroup = { label: string | null; items: AdminNavItem[] };

const route = (path: string) => path as Route;

/** Where staff sign in (Figma 410:1605); also where a signed-out staff browser lands. */
export const ADMIN_SIGN_IN_PATH = '/admin/sign-in';

/**
 * The admin sidebar (shell template, Figma 401:1432). The groups come from V2 §7.17 and the P12
 * permissions: each row names what a role needs to open it, so a role sees only its own rows
 * (`ADMIN_ROLE_PERMISSIONS`). A Curator sees no People and no Audit log. The server checks again
 * on every request; hiding a row is a courtesy, not the guard.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: null,
    items: [
      {
        key: 'overview',
        label: 'Overview',
        href: route('/admin'),
        icon: 'HomeLine',
        permission: null,
        built: true,
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        key: 'users',
        label: 'Users',
        href: route('/admin/users'),
        icon: 'Users01',
        permission: 'users.read',
      },
      {
        key: 'staff',
        label: 'Staff & roles',
        href: route('/admin/staff'),
        icon: 'ShieldTick',
        permission: 'roles.assign',
      },
      {
        key: 'deletions',
        label: 'Deletion requests',
        href: route('/admin/deletion-requests'),
        icon: 'UserX01',
        permission: 'users.manage',
        badge: { queue: 'deletionRequests', tone: 'neutral' },
      },
    ],
  },
  {
    label: 'Content',
    items: [
      {
        key: 'prompts',
        label: 'AI prompts',
        href: route('/admin/prompts'),
        icon: 'Stars02',
        permission: 'content.manage',
        badge: { queue: 'promptDrafts', tone: 'brand' },
      },
      {
        key: 'technologies',
        label: 'Technology KB',
        href: route('/admin/technologies'),
        icon: 'Database01',
        permission: 'content.manage',
        badge: { queue: 'kbReview', tone: 'brand' },
      },
      {
        key: 'skills',
        label: 'Skills & aliases',
        href: route('/admin/skills'),
        icon: 'Tag01',
        permission: 'content.manage',
      },
      {
        key: 'templates',
        label: 'Templates',
        href: route('/admin/templates'),
        icon: 'LayoutAlt01',
        permission: 'content.manage',
      },
      {
        key: 'rubric',
        label: 'ATS rubric',
        href: route('/admin/rubric'),
        icon: 'Scale02',
        permission: 'analytics.read',
      },
    ],
  },
  {
    label: 'Business',
    items: [
      {
        key: 'plans',
        label: 'Plans & pricing',
        href: route('/admin/plans'),
        icon: 'CreditCard02',
        permission: 'plans.manage',
      },
      {
        key: 'analytics',
        label: 'Analytics',
        href: route('/admin/analytics'),
        icon: 'BarChart10',
        permission: 'analytics.read',
      },
      {
        key: 'providers',
        label: 'Job providers',
        href: route('/admin/providers'),
        icon: 'Globe01',
        permission: 'providers.manage',
      },
    ],
  },
  {
    label: 'Trust & safety',
    items: [
      {
        key: 'failures',
        label: 'Generation failures',
        href: route('/admin/failures'),
        icon: 'AlertTriangle',
        permission: 'users.read',
        badge: { queue: 'generationFailures', tone: 'danger' },
      },
      {
        key: 'abuse',
        label: 'Abuse reports',
        href: route('/admin/abuse-reports'),
        icon: 'Flag01',
        permission: 'users.read',
        badge: { queue: 'abuseReports', tone: 'danger' },
      },
      {
        key: 'audit',
        label: 'Audit log',
        href: route('/admin/audit'),
        icon: 'ClipboardCheck',
        permission: 'audit.read',
      },
    ],
  },
];

/** Pinned to the sidebar's foot. */
export const ADMIN_NAV_FOOTER: AdminNavItem[] = [
  {
    key: 'settings',
    label: 'Settings',
    href: route('/admin/settings'),
    icon: 'Settings01',
    permission: 'roles.assign',
  },
  {
    key: 'help',
    label: 'Help & runbooks',
    href: route('/admin/help'),
    icon: 'HelpCircle',
    permission: null,
  },
];

const ALL = [...ADMIN_NAV.flatMap((group) => group.items), ...ADMIN_NAV_FOOTER];

/** The row a path belongs to: `/admin` exactly for Overview, otherwise the longest prefix. */
export function activeAdminItem(pathname: string): AdminNavItem | undefined {
  if (pathname === '/admin' || pathname === '/admin/') return ALL[0];
  return ALL.filter((item) => item.href !== '/admin' && pathname.startsWith(item.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}

/** The nav as one role sees it: rows it can't open are gone, and so is a group left empty. */
export function navFor(permissions: readonly AdminPermission[]): AdminNavGroup[] {
  const can = (item: AdminNavItem) =>
    item.permission === null || permissions.includes(item.permission);
  return ADMIN_NAV.map((group) => ({ ...group, items: group.items.filter(can) })).filter(
    (group) => group.items.length > 0,
  );
}

export function footerFor(permissions: readonly AdminPermission[]): AdminNavItem[] {
  return ADMIN_NAV_FOOTER.filter(
    (item) => item.permission === null || permissions.includes(item.permission),
  );
}

/** The breadcrumb above a page: its group ("People"), or "Admin" for Overview and the foot rows. */
export function crumbFor(item: AdminNavItem | undefined): string {
  if (!item) return 'Admin';
  return ADMIN_NAV.find((group) => group.items.includes(item))?.label ?? 'Admin';
}

/** Finds an unbuilt section's row by its path segment, for its "coming soon" page. */
export function adminItemBySegment(segment: string): AdminNavItem | undefined {
  return ALL.find((item) => item.href === `/admin/${segment}`);
}
