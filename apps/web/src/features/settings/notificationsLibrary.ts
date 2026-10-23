import type {
  NotificationChannel,
  NotificationSettings,
  NotificationTopic,
} from '@nextkin/shared/models';

/**
 * What the Settings → Notifications board (Figma 247:1094) offers, and how a switch changes the
 * settings. See `toreview.md` §24.
 */

/** The three channels and the line under each (247:1304-1337), verbatim, in the board's order. */
export const NOTIFICATION_CHANNELS: readonly {
  id: NotificationChannel;
  label: string;
  description: string;
}[] = [
  { id: 'inApp', label: 'In-app', description: 'Instant notifications' },
  { id: 'email', label: 'Email', description: 'Important updates' },
  { id: 'push', label: 'Push', description: 'On your device' },
];

/** The seven topics and the line under each (247:1339-1498), verbatim, in the board's order. */
export const NOTIFICATION_TOPICS: readonly {
  id: NotificationTopic;
  label: string;
  description: string;
}[] = [
  {
    id: 'jobMatches',
    label: 'Job matches',
    description: 'Get notified about new job matches tailored to you.',
  },
  {
    id: 'applicationUpdates',
    label: 'Application updates',
    description: 'Updates on your application status.',
  },
  {
    id: 'interviewReminders',
    label: 'Interview reminders',
    description: 'Reminders for upcoming interviews and events.',
  },
  {
    id: 'resumeInsights',
    label: 'Resume insights',
    description: 'Tips and insights about your resume.',
  },
  {
    id: 'productUpdates',
    label: 'Product updates',
    description: 'Be the first to know about new features.',
  },
  {
    id: 'tips',
    label: 'Tips & recommendations',
    description: 'Career tips, articles, and personalized suggestions.',
  },
  {
    id: 'accountSecurity',
    label: 'Account & security',
    description: 'Important updates about your account and security.',
  },
];

/** A whole channel turned on or off. Its topics keep their own switches for when it's back. */
export const withChannel = (
  settings: NotificationSettings,
  channel: NotificationChannel,
  on: boolean,
): NotificationSettings => ({ ...settings, channels: { ...settings.channels, [channel]: on } });

/** One topic on one channel turned on or off, everything else as it was. */
export const withTopicChannel = (
  settings: NotificationSettings,
  topic: NotificationTopic,
  channel: NotificationChannel,
  on: boolean,
): NotificationSettings => ({
  ...settings,
  topics: { ...settings.topics, [topic]: { ...settings.topics[topic], [channel]: on } },
});
