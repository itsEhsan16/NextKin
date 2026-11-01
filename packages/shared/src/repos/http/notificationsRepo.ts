import type { Notification } from '../../models/notification';
import { notificationListSchema, notificationPrefsSchema, notificationSchema, notificationSettingsSchema } from '../../schemas/account';
import type { NotificationsRepo } from '../types';
import type { HttpClient } from './client';

/**
 * `NotificationsRepo` over `/api/v1/notifications` and `/api/v1/me/notification-*`. The feed holds
 * what really happened on NextKin (owner, 2026-10-31; changes D-05); the preferences are the §17.3
 * per-user preferences.
 */
export const NOTIFICATIONS_FALLBACKS = [] as const satisfies readonly (keyof NotificationsRepo)[];

type Served = Exclude<keyof NotificationsRepo, (typeof NOTIFICATIONS_FALLBACKS)[number]>;

export function createHttpNotificationsRepo(http: HttpClient): Pick<NotificationsRepo, Served> {
  const prefs = async (init?: Parameters<HttpClient['request']>[1]) =>
    notificationPrefsSchema.parse(await http.request('/me/notification-prefs', init));
  const settings = async (path = '/me/notification-settings', init?: Parameters<HttpClient['request']>[1]) =>
    notificationSettingsSchema.parse(await http.request(path, init));
  return {
    list: async () => notificationListSchema.parse(await http.request('/notifications')).items as Notification[],
    markRead: async (id) => notificationSchema.parse(await http.request(`/notifications/${id}/read`, { method: 'POST' })) as Notification,
    async markAllRead() {
      await http.request('/notifications/read-all', { method: 'POST' });
    },
    async remove(id) {
      await http.request(`/notifications/${id}`, { method: 'DELETE' });
    },
    getPrefs: () => prefs(),
    setPrefs: (next) => prefs({ method: 'PUT', body: next }),
    getSettings: () => settings(),
    // Whole-set replace, as the interface says: two quick flips each send the full set.
    setSettings: (next) => settings('/me/notification-settings', { method: 'PUT', body: next }),
    resetSettings: () => settings('/me/notification-settings/reset', { method: 'POST' }),
    async registerDevice(device) {
      await http.request('/notifications/devices', { method: 'POST', body: device });
    },
    async removeDevice(token) {
      await http.request('/notifications/devices/remove', { method: 'POST', body: { token } });
    },
  };
}
