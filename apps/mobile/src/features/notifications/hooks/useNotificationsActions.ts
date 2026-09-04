import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { Notification } from '@/data/models';
import { useMarkNotificationRead } from '@/data/queries';

import { useNotificationsStore } from '../notificationsStore';

/** Every tap target on the notifications screens resolves here. */
export function useNotificationsActions() {
  const router = useRouter();
  const markRead = useMarkNotificationRead();
  const openMenuFor = useNotificationsStore((state) => state.openMenu);

  return useMemo(
    () => ({
      goBack: () => router.back(),
      openPreferences: () => router.push('/notifications/preferences'),
      // Note 1:2497: opening a row clears its tint (mark read) and deep-links to the exact
      // destination. `navigate` rather than `push` so tab-root links (the matches digest)
      // land on the tab instead of stacking a copy over the feed.
      openNotification: (notification: Notification) => {
        if (!notification.read) markRead.mutate(notification.id);
        if (notification.deepLink) {
          router.navigate(notification.deepLink as Parameters<typeof router.navigate>[0]);
        }
      },
      openMenu: (notification: Notification) => openMenuFor(notification),
      // NOTIF 05's CTA — today's matches live on the Jobs tab.
      exploreMatches: () => router.navigate('/jobs'),
    }),
    [markRead, openMenuFor, router],
  );
}
