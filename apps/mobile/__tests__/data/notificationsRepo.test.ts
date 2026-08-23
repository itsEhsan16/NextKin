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

  it('lists all notifications newest first with 5 unread', async () => {
    const list = await flush(repos.notifications.list());

    expect(list).toHaveLength(notificationsFixture.length);
    expect(unreadCount(list)).toBe(5);
    const dates = list.map((n) => n.createdAt);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });

  it('markRead() decrements the unread count and persists', async () => {
    const unread = (await flush(repos.notifications.list())).find((n) => !n.read);
    expect(unread).toBeDefined();

    const updated = await flush(repos.notifications.markRead(unread!.id));
    expect(updated.read).toBe(true);

    const list = await flush(repos.notifications.list());
    expect(unreadCount(list)).toBe(4);
    expect(list.find((n) => n.id === unread!.id)?.read).toBe(true);
  });

  it('markRead() is idempotent', async () => {
    await flush(repos.notifications.markRead('ntf_1'));
    await flush(repos.notifications.markRead('ntf_1'));
    expect(unreadCount(await flush(repos.notifications.list()))).toBe(4);
  });

  it('markAllRead() clears the unread count', async () => {
    await flush(repos.notifications.markAllRead());
    expect(unreadCount(await flush(repos.notifications.list()))).toBe(0);
  });

  it('remove() drops the notification', async () => {
    await flush(repos.notifications.remove('ntf_2'));
    const list = await flush(repos.notifications.list());
    expect(list.map((n) => n.id)).not.toContain('ntf_2');
    expect(unreadCount(list)).toBe(4);
  });

  it('setPrefs() round-trips', async () => {
    const prefs = await flush(repos.notifications.getPrefs());
    const next = { ...prefs, push: false, categories: { ...prefs.categories, jobs: false } };
    await flush(repos.notifications.setPrefs(next));
    expect(await flush(repos.notifications.getPrefs())).toEqual(next);
  });

  it('does not mutate the fixture', async () => {
    await flush(repos.notifications.markAllRead());
    expect(unreadCount(notificationsFixture)).toBe(5);
  });
});
