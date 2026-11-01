import { readPushToken } from '@/lib/pushDevice';
import { storage } from '@/lib/storage';

import { repos } from './repos';

const REGISTERED_KEY = 'push.registeredToken';

/** The phone's own zone puts a nudge at 9am where it is, and quiet hours on its clock. */
const timeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/** Tells the server this phone said yes. Repeating it is fine, and it picks up a new token or zone. */
export async function registerPushDevice(): Promise<void> {
  const device = await readPushToken();
  if (!device) return;
  await repos.notifications.registerDevice({ ...device, timeZone: timeZone() });
  storage.set(REGISTERED_KEY, device.token);
}

/** On signing out, while the session still works. A failure can't hold the sign-out up. */
export async function forgetPushDevice(): Promise<void> {
  const token = storage.get<string>(REGISTERED_KEY);
  if (!token) return;
  storage.remove(REGISTERED_KEY);
  await repos.notifications.removeDevice(token).catch(() => undefined);
}
