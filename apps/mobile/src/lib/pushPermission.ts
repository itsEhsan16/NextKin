import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Distilled from expo-notifications' PermissionStatus + canAskAgain. */
export type PushPermission = 'undetermined' | 'granted' | 'denied';

type PermissionResponse = { granted: boolean; canAskAgain: boolean };
type NotificationsModule = {
  getPermissionsAsync(): Promise<PermissionResponse>;
  requestPermissionsAsync(): Promise<PermissionResponse>;
};

let cached: NotificationsModule | null | undefined;

/**
 * expo-notifications must NEVER be imported statically: since SDK 53, merely loading the
 * module on Android inside Expo Go errors ("remote notifications removed from Expo Go") —
 * and this file lives in the @/lib barrel, so a static import took every route down with it.
 * Expo Go on Android therefore skips the module entirely and reports 'undetermined' (the
 * primer still shows; its CTA is inert until a dev build exists — plan §Phase 7), while iOS
 * Expo Go and dev builds get the real permission API.
 */
function notificationsModule(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (Platform.OS === 'android' && inExpoGo) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

const toPermission = (response: PermissionResponse): PushPermission => {
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'undetermined' : 'denied';
};

/**
 * Push-permission STATE only — no tokens, no delivery (V2 §9.12 defers push to Release 2).
 * The OS dialog fires exclusively from `requestPushPermission` / `usePushPermission().request`,
 * never as a side effect of reading the status (canvas note 1:2939: contextual asks roughly
 * triple opt-in; an iOS denial is permanent). Errors degrade to 'undetermined' so a missing
 * native module never crashes a screen.
 */
export async function getPushPermission(): Promise<PushPermission> {
  const module = notificationsModule();
  if (!module) return 'undetermined';
  try {
    return toPermission(await module.getPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

export async function requestPushPermission(): Promise<PushPermission> {
  const module = notificationsModule();
  if (!module) return 'undetermined';
  try {
    return toPermission(await module.requestPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

/** Live permission state + a `request` that re-reads after the OS dialog closes. */
export function usePushPermission() {
  const [status, setStatus] = useState<PushPermission | 'unknown'>('unknown');

  useEffect(() => {
    let alive = true;
    void getPushPermission().then((value) => {
      if (alive) setStatus(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  const request = useCallback(async () => {
    const value = await requestPushPermission();
    setStatus(value);
    return value;
  }, []);

  return { status, request };
}
