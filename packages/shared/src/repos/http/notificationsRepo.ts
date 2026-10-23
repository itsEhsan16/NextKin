import { notificationPrefsSchema, notificationSettingsSchema } from '../../schemas/account';
import type { NotificationsRepo } from '../types';
import type { HttpClient } from './client';

/**
 * `NotificationsRepo` over `/api/v1/me/notification-*` (ImBackendImplementationPlan P5-06): the
 * preferences are served, stored as the §17.3 per-user preferences. The feed itself stays on the
 * mock until D-05 decides what produces notifications.
 */
export const NOTIFICATIONS_FALLBACKS = ['list', 'markRead', 'markAllRead', 'remove'] as const satisfies readonly (keyof NotificationsRepo)[];

type Served = Exclude<keyof NotificationsRepo, (typeof NOTIFICATIONS_FALLBACKS)[number]>;

export function createHttpNotificationsRepo(http: HttpClient): Pick<NotificationsRepo, Served> {
  const prefs = async (init?: Parameters<HttpClient['request']>[1]) =>
    notificationPrefsSchema.parse(await http.request('/me/notification-prefs', init));
  const settings = async (path = '/me/notification-settings', init?: Parameters<HttpClient['request']>[1]) =>
    notificationSettingsSchema.parse(await http.request(path, init));
  return {
    getPrefs: () => prefs(),
    setPrefs: (next) => prefs({ method: 'PUT', body: next }),
    getSettings: () => settings(),
    // Whole-set replace, as the interface says: two quick flips each send the full set.
    setSettings: (next) => settings('/me/notification-settings', { method: 'PUT', body: next }),
    resetSettings: () => settings('/me/notification-settings/reset', { method: 'POST' }),
  };
}
