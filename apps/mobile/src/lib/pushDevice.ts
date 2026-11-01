import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { getPushPermission, notificationsModule } from './pushPermission';

/** The Android channel the server aims at; FCM drops a message for a channel that doesn't exist. */
export const PUSH_CHANNEL = 'default';
const DEFAULT_IMPORTANCE = 3;

/**
 * This phone's Firebase or Apple token: SNS sends to those directly, so it's the device token and
 * not an Expo one. Null without permission, and in Expo Go, where a push can't arrive.
 */
export async function readPushToken(): Promise<{ platform: 'android' | 'ios'; token: string } | null> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  const module = notificationsModule();
  if (!module || (await getPushPermission()) !== 'granted') return null;
  try {
    if (Platform.OS === 'android') {
      await module.setNotificationChannelAsync(PUSH_CHANNEL, {
        name: 'NextKin',
        importance: DEFAULT_IMPORTANCE,
      });
    }
    const { data } = await module.getDevicePushTokenAsync();
    return typeof data === 'string' && data ? { platform: Platform.OS, token: data } : null;
  } catch {
    // No network, or no Firebase file in this build. The next launch tries again.
    return null;
  }
}

export type PushTap = { url?: string; notificationId?: string };

type TapData = { url?: unknown; notificationId?: unknown };

export type TappedNotification = {
  notification: {
    request: {
      content: { data?: TapData | null };
      trigger?: { payload?: TapData; remoteMessage?: { data?: TapData } } | null;
    };
  };
};

/** Only a path inside the app: a push is never a way to open somewhere else. */
const inAppPath = (value: unknown): string | undefined =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined;

/**
 * Where a tapped push goes. A message straight from Firebase or Apple keeps its fields on the
 * trigger rather than in `content.data`, which only Expo's own service fills.
 */
export function pushTapOf(response: TappedNotification): PushTap {
  const { content, trigger } = response.notification.request;
  const data = trigger?.remoteMessage?.data ?? trigger?.payload ?? content.data ?? {};
  const url = inAppPath(data.url);
  const id = data.notificationId;
  return { ...(url ? { url } : {}), ...(typeof id === 'string' && id ? { notificationId: id } : {}) };
}
