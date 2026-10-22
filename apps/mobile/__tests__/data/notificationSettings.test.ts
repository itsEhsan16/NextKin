import { createMockRepos } from '@/data/repos';
import { createMockStore } from '@/data/repos/state';

/**
 * The web Settings → Notifications board's switches (Figma 247:1290). Each switch sends the
 * whole set, so the repo keeps what it is given; "Reset to default" returns to the board's.
 */
describe('NotificationsRepo (mock) — settings', () => {
  it('keeps the set it is given, and resets to the defaults', async () => {
    const store = createMockStore();
    const repos = createMockRepos(store);
    const before = store.state.notificationSettings;

    await repos.notifications.setSettings({
      ...before,
      channels: { ...before.channels, push: false },
    });
    expect(store.state.notificationSettings.channels.push).toBe(false);

    const reset = await repos.notifications.resetSettings();
    expect(reset.channels.push).toBe(true);
    expect(store.state.notificationSettings.topics.productUpdates).toEqual({
      inApp: true,
      email: false,
      push: false,
    });
  });
});
