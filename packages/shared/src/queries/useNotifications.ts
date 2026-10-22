import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Notification, NotificationPrefs, NotificationSettings } from '../models';
import { repos } from '../repos';

import { qk } from './keys';
import { refetchWhenQueueEmpty, writeQueue } from './writeQueue';

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

/** Mobile's notification switches save as they flip, so their writes queue (see `writeQueue`). */
const PREFS_QUEUE = 'notification-prefs';

export function useSetNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) => repos.notifications.setPrefs(prefs),
    // Two quick flips used to bounce: the first write's refetch landed before the second write,
    // flipping the second switch back until its own save came through.
    ...writeQueue(PREFS_QUEUE),
    onMutate: async (prefs) => {
      await queryClient.cancelQueries({ queryKey: qk.notifications.prefs() });
      const previous = queryClient.getQueryData<NotificationPrefs>(qk.notifications.prefs());
      queryClient.setQueryData(qk.notifications.prefs(), prefs);
      return { previous };
    },
    onError: (_error, _prefs, context) => {
      if (context?.previous) queryClient.setQueryData(qk.notifications.prefs(), context.previous);
    },
    onSettled: () => refetchWhenQueueEmpty(queryClient, PREFS_QUEUE, qk.notifications.prefs()),
  });
}

/** Every write to the web's notification settings goes through one queue (see `writeQueue`). */
const SETTINGS_QUEUE = 'notification-settings';

/** The web board's channels and topics (Figma 247:1290); mobile reads `useNotificationPrefs`. */
export function useNotificationSettings() {
  return useQuery({
    queryKey: qk.notifications.settings(),
    queryFn: () => repos.notifications.getSettings(),
  });
}

/**
 * One switch at a time, optimistic. The caller builds the whole set on what the cache already
 * shows, so a second flip made before the first has saved still carries the first.
 */
export function useSetNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: NotificationSettings) => repos.notifications.setSettings(settings),
    ...writeQueue(SETTINGS_QUEUE),
    onMutate: async (settings) => {
      await queryClient.cancelQueries({
        queryKey: qk.notifications.settings(),
      });
      const previous = queryClient.getQueryData<NotificationSettings>(qk.notifications.settings());
      queryClient.setQueryData(qk.notifications.settings(), settings);
      return { previous };
    },
    onError: (_error, _settings, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk.notifications.settings(), context.previous);
      }
    },
    onSettled: () =>
      refetchWhenQueueEmpty(queryClient, SETTINGS_QUEUE, qk.notifications.settings()),
  });
}

/**
 * "Reset to default" (247:1298). It queues behind any switch still saving, and the defaults come
 * back with the write, so they replace the cache as they arrive with nothing to refetch. The card
 * holds its switches meanwhile: a flip built on the old values would undo the reset.
 */
export function useResetNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repos.notifications.resetSettings(),
    ...writeQueue(SETTINGS_QUEUE),
    onSuccess: (settings) => queryClient.setQueryData(qk.notifications.settings(), settings),
  });
}
