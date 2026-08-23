/** NextKin V2 spec §10 — Notifications aggregate (candidate app). */

export type NotificationCategory = 'generation' | 'jobs' | 'profile' | 'billing' | 'system';

export type Notification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** ISO-8601 */
  createdAt: string;
  read: boolean;
  /** In-app path (expo-router href), e.g. "/resumes/res_1". */
  deepLink?: string;
  /** Ionicons glyph name; falls back to the category icon when absent. */
  icon?: string;
};

export type NotificationPrefs = {
  push: boolean;
  categories: Record<NotificationCategory, boolean>;
};

export type NotificationCategoryMeta = {
  key: NotificationCategory;
  label: string;
  description: string;
};

export const NOTIFICATION_CATEGORIES: readonly NotificationCategoryMeta[] = [
  {
    key: 'generation',
    label: 'Resume generation',
    description: 'When a resume or cover letter is ready or needs attention',
  },
  {
    key: 'jobs',
    label: 'Job matches',
    description: 'New picks, saved-job updates and closing deadlines',
  },
  {
    key: 'profile',
    label: 'Profile',
    description: 'Reminders to complete or refresh your profile',
  },
  {
    key: 'billing',
    label: 'Billing',
    description: 'Plan limits, renewals and receipts',
  },
  {
    key: 'system',
    label: 'System',
    description: 'Product updates and maintenance notices',
  },
] as const;
