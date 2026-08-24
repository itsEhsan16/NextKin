import {
  matchesNotificationFilter,
  notificationGroup,
  NOTIFICATION_CATEGORIES,
  type Notification,
} from '@/data/models';
import { keepCaption } from '@/features/notifications';
import { formatFeedTime, parseBold, stripBold } from '@/lib';
import { notificationPrefsFixture } from '@/data/mock';

const notif = (overrides: Partial<Notification>): Notification => ({
  id: 'ntf_x',
  category: 'applications',
  body: 'plain',
  createdAt: '2026-08-23T10:00:00.000Z',
  read: false,
  visual: { kind: 'logo', company: 'Stripe' },
  ...overrides,
});

describe('parseBold (rich feed lines)', () => {
  it('splits bold runs and round-trips the plain text', () => {
    const runs = parseBold('**Stripe** viewed your application');
    expect(runs).toEqual([
      { text: 'Stripe', bold: true },
      { text: ' viewed your application', bold: false },
    ]);
    expect(stripBold('Your **ATS score** is ready. It scored **88**.')).toBe(
      'Your ATS score is ready. It scored 88.',
    );
  });

  it('renders unterminated markers literally instead of eating text', () => {
    expect(parseBold('oops **half open')).toEqual([{ text: 'oops **half open', bold: false }]);
  });
});

describe('notification filter pills (Figma 1:2410)', () => {
  it('maps Jobs to matches + closing + AI, Applications and Account to their own', () => {
    expect(matchesNotificationFilter(notif({ category: 'matches' }), 'jobs')).toBe(true);
    expect(matchesNotificationFilter(notif({ category: 'closing' }), 'jobs')).toBe(true);
    expect(matchesNotificationFilter(notif({ category: 'ai' }), 'jobs')).toBe(true);
    expect(matchesNotificationFilter(notif({ category: 'applications' }), 'jobs')).toBe(false);
    expect(matchesNotificationFilter(notif({ category: 'applications' }), 'applications')).toBe(true);
    expect(matchesNotificationFilter(notif({ category: 'billing' }), 'account')).toBe(true);
    expect(matchesNotificationFilter(notif({ category: 'billing' }), 'jobs')).toBe(false);
    expect(matchesNotificationFilter(notif({ category: 'billing' }), 'all')).toBe(true);
  });
});

describe('feed grouping and timestamps (Figma 1:2419)', () => {
  const now = new Date('2026-08-23T12:00:00');

  it('groups by calendar day, then the trailing week, then earlier', () => {
    expect(notificationGroup('2026-08-23T02:00:00', now)).toBe('today');
    expect(notificationGroup('2026-08-22T23:00:00', now)).toBe('week');
    expect(notificationGroup('2026-08-17T13:00:00', now)).toBe('week');
    expect(notificationGroup('2026-08-10T12:00:00', now)).toBe('earlier');
  });

  it('formats hours today, weekday within the week, short date beyond', () => {
    expect(formatFeedTime('2026-08-23T10:00:00', now)).toBe('2h ago');
    // 2026-08-18 is a Tuesday.
    expect(formatFeedTime('2026-08-18T09:00:00', now)).toBe('Tue');
    expect(formatFeedTime('2026-07-24T09:00:00', now)).toBe('Jul 24');
  });
});

describe('row-menu captions (Figma 1:2707)', () => {
  it('lists the categories that stay on, artboard-style', () => {
    // Fixture: billing already off. Turning off applications keeps matches, closing, AI.
    expect(keepCaption(notif({ category: 'applications' }), notificationPrefsFixture)).toBe(
      'You keep matches, closing alerts and AI results',
    );
  });

  it('degrades gracefully as categories disappear', () => {
    const onlyAi = {
      ...notificationPrefsFixture,
      categories: {
        matches: false,
        closing: false,
        applications: true,
        ai: true,
        billing: false,
      },
    };
    expect(keepCaption(notif({ category: 'applications' }), onlyAi)).toBe('You keep AI results');
  });

  it('has meta for every category', () => {
    expect(NOTIFICATION_CATEGORIES).toHaveLength(5);
  });
});
