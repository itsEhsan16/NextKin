import { notificationsFixture, useMockModeStore } from '@/data/mock';
import { repos, resetMockRepos } from '@/data/repos';

async function flush<T>(promise: Promise<T>): Promise<T> {
  const [value] = await Promise.all([promise, jest.advanceTimersByTimeAsync(3000)]);
  return value;
}

const unreadCount = (items: { read: boolean }[]) => items.filter((n) => !n.read).length;

describe('NotificationsRepo (mock)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    resetMockRepos();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists all notifications newest first with 4 unread (NOTIF 01)', async () => {
    const list = await flush(repos.notifications.list());

    expect(list).toHaveLength(notificationsFixture.length);
    expect(unreadCount(list)).toBe(4);
    const dates = list.map((n) => n.createdAt);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });

  it('markRead() decrements the unread count and persists', async () => {
    const unread = (await flush(repos.notifications.list())).find((n) => !n.read);
    expect(unread).toBeDefined();

    const updated = await flush(repos.notifications.markRead(unread!.id));
    expect(updated.read).toBe(true);

    const list = await flush(repos.notifications.list());
    expect(unreadCount(list)).toBe(3);
    expect(list.find((n) => n.id === unread!.id)?.read).toBe(true);
  });

  it('markRead() is idempotent', async () => {
    await flush(repos.notifications.markRead('ntf_digest'));
    await flush(repos.notifications.markRead('ntf_digest'));
    expect(unreadCount(await flush(repos.notifications.list()))).toBe(3);
  });

  it('markAllRead() clears the unread count', async () => {
    await flush(repos.notifications.markAllRead());
    expect(unreadCount(await flush(repos.notifications.list()))).toBe(0);
  });

  it('remove() drops the notification', async () => {
    await flush(repos.notifications.remove('ntf_stripe_viewed'));
    const list = await flush(repos.notifications.list());
    expect(list.map((n) => n.id)).not.toContain('ntf_stripe_viewed');
    expect(unreadCount(list)).toBe(3);
  });

  it('setPrefs() round-trips the NOTIF 04 shape', async () => {
    const prefs = await flush(repos.notifications.getPrefs());
    expect(prefs.categories.billing).toBe(false); // the artboard's one off switch
    const next = {
      ...prefs,
      quietHours: false,
      categories: { ...prefs.categories, applications: false },
    };
    await flush(repos.notifications.setPrefs(next));
    expect(await flush(repos.notifications.getPrefs())).toEqual(next);
  });

  it('does not mutate the fixture', async () => {
    await flush(repos.notifications.markAllRead());
    expect(unreadCount(notificationsFixture)).toBe(4);
  });
});
