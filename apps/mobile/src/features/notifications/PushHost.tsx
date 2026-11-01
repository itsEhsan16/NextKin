import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { registerPushDevice } from '@/data/pushDevice';
import { qk, track, useMarkNotificationRead } from '@/data/queries';
import { notificationsModule, pushTapOf, type TappedNotification } from '@/lib';

/**
 * The phone's side of push (owner, 2026-11-01), mounted while signed in. It registers the phone once
 * a launch, which also picks up a new token or time zone, and opens where a tapped push points. A
 * push landing while the app is open shows as a banner, and the feed refreshes behind it.
 */
export function PushHost() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutate: markRead } = useMarkNotificationRead();

  useEffect(() => {
    void registerPushDevice().catch(() => undefined);
  }, []);

  useEffect(() => {
    const module = notificationsModule();
    if (!module) return;

    const open = (response: TappedNotification) => {
      const tap = pushTapOf(response);
      void module.clearLastNotificationResponseAsync().catch(() => undefined);
      track('push_opened');
      if (tap.notificationId) markRead(tap.notificationId);
      if (tap.url) router.navigate(tap.url as Parameters<typeof router.navigate>[0]);
    };

    module.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    // The tap that launched the app came before this listener existed.
    void module
      .getLastNotificationResponseAsync()
      .then((response) => {
        if (response) open(response);
      })
      .catch(() => undefined);

    const tapped = module.addNotificationResponseReceivedListener(open);
    const received = module.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications.list() });
    });
    return () => {
      tapped.remove();
      received.remove();
    };
  }, [markRead, queryClient, router]);

  return null;
}
