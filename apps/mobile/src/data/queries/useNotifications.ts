import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Notification, NotificationPrefs } from '@/data/models';
import { repos } from '@/data/repos';

import { qk } from './keys';

const listNotifications = () => repos.notifications.list();

export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications.list(),
    queryFn: listNotifications,
  });
}

const countUnread = (items: Notification[]): number => items.filter((n) => !n.read).length;

/** Derived from the same cache entry as `useNotifications` — no extra request. */
export function useUnreadCount() {
  return useQuery({
    queryKey: qk.notifications.list(),
    queryFn: listNotifications,
    select: countUnread,
  });
}

function useNotificationListMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<unknown>,
  update: (items: Notification[], vars: TVars) => Notification[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: qk.notifications.list() });
      const previous = queryClient.getQueryData<Notification[]>(qk.notifications.list());
      queryClient.setQueryData<Notification[]>(qk.notifications.list(), (old) =>
        old ? update(old, vars) : old,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(qk.notifications.list(), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.notifications.list() }),
  });
}

export function useMarkNotificationRead() {
  return useNotificationListMutation(
    (id: string) => repos.notifications.markRead(id),
    (items, id) => items.map((n) => (n.id === id ? { ...n, read: true } : n)),
  );
}

export function useMarkAllNotificationsRead() {
  return useNotificationListMutation(
    () => repos.notifications.markAllRead(),
    (items) => items.map((n) => (n.read ? n : { ...n, read: true })),
  );
}

export function useRemoveNotification() {
  return useNotificationListMutation(
    (id: string) => repos.notifications.remove(id),
    (items, id) => items.filter((n) => n.id !== id),
  );
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: qk.notifications.prefs(),
    queryFn: () => repos.notifications.getPrefs(),
  });
}

export function useSetNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) => repos.notifications.setPrefs(prefs),
    onMutate: async (prefs) => {
      await queryClient.cancelQueries({ queryKey: qk.notifications.prefs() });
      const previous = queryClient.getQueryData<NotificationPrefs>(qk.notifications.prefs());
      queryClient.setQueryData(qk.notifications.prefs(), prefs);
      return { previous };
    },
    onError: (_error, _prefs, context) => {
      if (context?.previous) queryClient.setQueryData(qk.notifications.prefs(), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.notifications.prefs() }),
  });
}
