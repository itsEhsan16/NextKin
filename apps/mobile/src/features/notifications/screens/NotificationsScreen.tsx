import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  NOTIFICATION_FILTERS,
  NOTIFICATION_GROUP_LABEL,
  matchesNotificationFilter,
  notificationGroup,
  type Notification,
  type NotificationGroup,
} from '@/data/models';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPrefs,
  useNotifications,
  useRemoveNotification,
  useSetNotificationPrefs,
} from '@/data/queries';
import { a11yButton, a11yHeader, hitSlop8, pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { NotificationRow } from '../components/NotificationRow';
import { RowMenuSheetBody } from '../components/RowMenuSheetBody';
import { NotificationsCaughtUp, NotificationsFirstUse } from '../components/NotificationsStates';
import { useNotificationsActions } from '../hooks/useNotificationsActions';
import { useNotificationsStore } from '../notificationsStore';

type FeedItem =
  | { type: 'header'; group: NotificationGroup }
  | { type: 'row'; notification: Notification };

const feedKey = (item: FeedItem) =>
  item.type === 'header' ? `header-${item.group}` : item.notification.id;

/**
 * NOTIF 01–03 + 05/06 — the feed. Chrome (back/title/gear, unread meta, filter pills) is
 * fixed; the list scrolls under it with TODAY / THIS WEEK / EARLIER headers pinned via
 * stickyHeaderIndices. The pinned-only hairline the note sketches (1:2497) is drawn on every
 * header — FlashList exposes no "currently pinned" signal to key it off.
 */
export function NotificationsScreen() {
  const { colors, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const actions = useNotificationsActions();

  const filter = useNotificationsStore((state) => state.filter);
  const setFilter = useNotificationsStore((state) => state.setFilter);
  const menuOpen = useNotificationsStore((state) => state.menuOpen);
  const menuNotification = useNotificationsStore((state) => state.menuNotification);
  const closeMenu = useNotificationsStore((state) => state.closeMenu);

  const notifications = useNotifications();
  const prefs = useNotificationPrefs();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const remove = useRemoveNotification();
  const setPrefs = useSetNotificationPrefs();

  const list = useMemo(() => notifications.data ?? [], [notifications.data]);
  const unreadCount = useMemo(() => list.filter((item) => !item.read).length, [list]);

  const { items, stickyIndices } = useMemo(() => {
    const filtered = list.filter((item) => matchesNotificationFilter(item, filter));
    const byGroup = new Map<NotificationGroup, Notification[]>();
    for (const notification of filtered) {
      const group = notificationGroup(notification.createdAt);
      byGroup.set(group, [...(byGroup.get(group) ?? []), notification]);
    }
    const result: FeedItem[] = [];
    const sticky: number[] = [];
    for (const group of ['today', 'week', 'earlier'] as const) {
      const rows = byGroup.get(group);
      if (!rows?.length) continue;
      sticky.push(result.length);
      result.push({ type: 'header', group });
      rows.forEach((notification) => result.push({ type: 'row', notification }));
    }
    return { items: result, stickyIndices: sticky };
  }, [filter, list]);

  const handleMarkRead = useCallback(
    (notification: Notification) => {
      if (!notification.read) markRead.mutate(notification.id);
    },
    [markRead],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.type === 'header') {
        return (
          <View style={[styles.groupHeader, { backgroundColor: colors.surfacePage }]}>
            <Text
              variant="overline"
              color="textSecondary"
              accessibilityRole="header"
              style={{ paddingHorizontal: spacing.gutter }}
            >
              {NOTIFICATION_GROUP_LABEL[item.group]}
            </Text>
            <View style={[styles.pinnedHairline, { backgroundColor: colors.divider }]} />
          </View>
        );
      }
      return (
        <NotificationRow
          notification={item.notification}
          onOpen={actions.openNotification}
          onMarkRead={handleMarkRead}
          onMore={actions.openMenu}
        />
      );
    },
    [actions.openMenu, actions.openNotification, colors, handleMarkRead, spacing.gutter, styles],
  );

  const status = notifications.isPending ? 'pending' : notifications.isError ? 'error' : 'success';
  const firstUse = status === 'success' && list.length === 0;
  const caughtUp = status === 'success' && list.length > 0 && items.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.surfacePage, paddingTop: insets.top }]}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.gutter, paddingTop: spacing[2] }]}>
        <IconButton icon="chevron-left" label="Back" onPress={actions.goBack} />
        <Text {...a11yHeader()} variant="headline" align="center" style={styles.headerTitle}>
          Notifications
        </Text>
        <IconButton icon="cog" label="Notification preferences" onPress={actions.openPreferences} />
      </View>

      {!firstUse && !caughtUp && status === 'success' && unreadCount > 0 ? (
        <View style={[styles.metaRow, { paddingHorizontal: spacing.gutter, marginTop: spacing[3] }]}>
          <Text variant="caption" color="textSecondary">
            {pluralize(unreadCount, 'unread', 'unread')}
          </Text>
          <Pressable
            {...a11yButton('Mark all read')}
            feedback="subtle"
            haptic="selection"
            hitSlop={hitSlop8}
            onPress={() => markAllRead.mutate(undefined)}
          >
            <Text variant="captionSemiBold">Mark all read</Text>
          </Pressable>
        </View>
      ) : null}

      {!firstUse ? (
        <View style={[styles.pills, { paddingHorizontal: spacing.gutter, gap: spacing[2], marginTop: spacing[3] }]}>
          {NOTIFICATION_FILTERS.map((entry) => (
            <FilterChip
              key={entry.key}
              label={entry.label}
              variant="select"
              selected={filter === entry.key}
              onPress={() => setFilter(entry.key)}
            />
          ))}
        </View>
      ) : null}

      {status === 'pending' ? (
        <View style={{ padding: spacing.gutter, gap: spacing[3] }}>
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} height={s(78)} radius="card" />
          ))}
        </View>
      ) : status === 'error' ? (
        <StateView
          tone="danger"
          icon="exclamation-triangle"
          title="Couldn't load notifications"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void notifications.refetch()}
          style={{ marginTop: spacing[10] }}
        />
      ) : firstUse ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={{
            paddingHorizontal: spacing.gutter,
            paddingBottom: insets.bottom + spacing[6],
          }}
          showsVerticalScrollIndicator={false}
        >
          <NotificationsFirstUse onPreferences={actions.openPreferences} />
        </ScrollView>
      ) : caughtUp ? (
        <NotificationsCaughtUp onExplore={actions.exploreMatches} />
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={feedKey}
          getItemType={(item) => item.type}
          stickyHeaderIndices={stickyIndices}
          contentContainerStyle={{ paddingTop: spacing[2], paddingBottom: insets.bottom + spacing[8] }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <Pressable
              {...a11yButton('Manage notification types')}
              feedback="subtle"
              haptic="selection"
              hitSlop={hitSlop8}
              onPress={actions.openPreferences}
              style={[styles.manage, { padding: spacing.gutter, gap: spacing[1] + 2 }]}
            >
              <Text variant="segmentActive">Manage notification types</Text>
              <FontAwesome5 name="chevron-right" size={s(10)} color={colors.textPrimary} solid />
            </Pressable>
          }
        />
      )}

      {menuNotification ? (
        <Sheet
          open={menuOpen}
          onClose={closeMenu}
          height={sizes.sheetNotifHeight}
          accessibilityLabel="Notification actions"
        >
          <RowMenuSheetBody
            notification={menuNotification}
            prefs={prefs.data}
            onMarkRead={() => {
              handleMarkRead(menuNotification);
              closeMenu();
            }}
            onMuteCategory={() => {
              if (prefs.data) {
                setPrefs.mutate({
                  ...prefs.data,
                  categories: { ...prefs.data.categories, [menuNotification.category]: false },
                });
              }
              closeMenu();
            }}
            onDelete={() => {
              remove.mutate(menuNotification.id);
              closeMenu();
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: s(8) },
  groupHeader: { height: s(40), justifyContent: 'center' },
  pinnedHairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  manage: { flexDirection: 'row', alignItems: 'center' },
}));
