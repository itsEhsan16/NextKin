import { notificationSettingsFixture, simulate } from '../mock';
import type { Notification } from '../models';

import { clone, findOrThrow, type MockStore } from './state';
import type { NotificationsRepo } from './types';

const byCreatedDesc = (a: Notification, b: Notification): number =>
  b.createdAt.localeCompare(a.createdAt);

export function createMockNotificationsRepo(store: MockStore): NotificationsRepo {
  const find = (id: string): Notification =>
    findOrThrow(store.state.notifications, id, 'Notification');

  return {
    list: () =>
      simulate(() => clone([...store.state.notifications].sort(byCreatedDesc)), {
        empty: () => [],
      }),

    markRead: (id) =>
      simulate(() => {
        const updated: Notification = { ...find(id), read: true };
        store.state.notifications = store.state.notifications.map((item) =>
          item.id === id ? updated : item,
        );
        return clone(updated);
      }),

    markAllRead: () =>
      simulate(() => {
        store.state.notifications = store.state.notifications.map((item) =>
          item.read ? item : { ...item, read: true },
        );
      }),

    remove: (id) =>
      simulate(() => {
        find(id);
        store.state.notifications = store.state.notifications.filter((item) => item.id !== id);
      }),

    getPrefs: () => simulate(() => clone(store.state.notificationPrefs)),

    setPrefs: (prefs) =>
      simulate(() => {
        store.state.notificationPrefs = clone(prefs);
        return clone(prefs);
      }),

    getSettings: () => simulate(() => clone(store.state.notificationSettings)),

    setSettings: (settings) =>
      simulate(() => {
        store.state.notificationSettings = clone(settings);
        return clone(settings);
      }),

    resetSettings: () =>
      simulate(() => {
        store.state.notificationSettings = clone(notificationSettingsFixture);
        return clone(notificationSettingsFixture);
      }),

    // The mock delivers nothing, so there's nothing for a phone to register with.
    registerDevice: () => simulate(() => undefined),
    removeDevice: () => simulate(() => undefined),
  };
}
