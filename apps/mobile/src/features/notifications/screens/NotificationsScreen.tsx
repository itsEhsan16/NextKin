import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  NOTIFICATION_FILTERS,
  NOTIFICATION_GROUP_LABEL,
  groupByAge,
  matchesNotificationFilter,
  type AgedFeedItem,
  type Notification,
} from '@/data/models';
import {
  queryPhase,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPrefs,
  useNotifications,
  useRemoveNotification,
  useSetNotificationPrefs,
} from '@/data/queries';
import { a11yButton, hitSlop8, pluralize, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { FilterChip } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { EdgeFade } from '@/ui/EdgeFade';
import { closeOpenSwipeRow } from '@/ui/SwipeableRow';
import { Text } from '@/ui/Text';
import { layoutTransition } from '@/ui/motion';

import { CARD_SPACING, NotificationRow } from '../components/NotificationRow';
import { RowMenuSheetBody } from '../components/RowMenuSheetBody';
import { NotificationsCaughtUp, NotificationsFirstUse } from '../components/NotificationsStates';
import { useNotificationsActions } from '../hooks/useNotificationsActions';
import { useNotificationsStore } from '../notificationsStore';

type FeedItem = AgedFeedItem<Notification>;

const feedKey = (item: FeedItem) => (item.type === 'header' ? `header-${item.group}` : item.row.id);

// The redesigned feed's rhythm at 390 (Figma 619:2), in artboard units.
/** Unread meta → filter pills (619:13). */
const PILLS_TOP = 14 / 0.75;
/** The pills are drawn 16 × 8 at 390 (619:15), roomier than the Jobs select chips. */
const PILL_PAD_X = 16 / 0.75;
const PILL_PAD_Y = 8 / 0.75;
/** Group label → its first card (619:38). */
const LABEL_BOTTOM = 10 / 0.75;
/** Last card → the next label: the card's own spacing plus one more 10 (619:73 + 619:74). */
const LABEL_TOP = 10 / 0.75;
/** Skeleton card height — the board's two-line card (619:99 is 89.5 at 390). */
const SKELETON_CARD = 90 / 0.75;

/**
 * NOTIF 01–03 + 05/06 — the feed, as NOTIF 01's redesign draws it (Figma 619:2): cards on the
 * page rather than full-bleed rows. Chrome (back/title/gear, unread meta, filter pills) is fixed;
 * the list scrolls under it with TODAY / THIS WEEK / EARLIER labels pinned via
 * stickyHeaderIndices. Scrolling closes a swiped-open card.
 *
 * The back row is the shared `ScreenHeader`, with the gear in its trailing slot, so the feed's
 * title sits exactly where every other pushed screen's does. `padded={false}` because the
 * list's group bands and hairlines run edge to edge; the gutter is added back per row.
 */
export function NotificationsScreen() {
  const { colors, motion, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  // "Mark all read" retires the unread row: it fades, and the pills and the feed under it glide up
  // into its place instead of jumping there.
  const layout = layoutTransition(reduced);
  const insets = useSafeAreaInsets();
  const actions = useNotificationsActions();

  const filter = useNotificationsStore((state) => state.filter);
  const setFilter = useNotificationsStore((state) => state.setFilter);
  const menuOpen = useNotificationsStore((state) => state.menuOpen);
  const menuNotification = useNotificationsStore((state) => state.menuNotification);
  const closeMenu = useNotificationsStore((state) => state.closeMenu);

  const notifications = useNotifications();
  const prefs = useNotificationPrefs();
  // `mutate` is stable; depending on the mutation object rebuilt `renderItem` every render.
  const { mutate: markRead } = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const remove = useRemoveNotification();
  const setPrefs = useSetNotificationPrefs();

  const list = useMemo(() => notifications.data ?? [], [notifications.data]);
  const unreadCount = useMemo(() => list.filter((item) => !item.read).length, [list]);

  // The grouping is shared with the History feed, which buckets its rows by the same rule.
  const { items, stickyIndices } = useMemo(
    () =>
      groupByAge(
        list.filter((item) => matchesNotificationFilter(item, filter)),
        (notification) => notification.createdAt,
      ),
    [filter, list],
  );

  const firstGroup = items[0]?.type === 'header' ? items[0].group : undefined;

  const handleMarkRead = useCallback(
    (notification: Notification) => {
      if (!notification.read) markRead(notification.id);
    },
    [markRead],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.type === 'header') {
        return (
          <View>
            <View
              style={{
                backgroundColor: colors.surfacePage,
                paddingHorizontal: spacing.gutter,
                // The list has no top padding of its own: FlashList draws a pinned header's copy at
                // the list's top edge, so padding outside the item put a second "TODAY" 18pt above
                // the real one (device pass, 2026-10-03). The first label carries that gap itself.
                paddingTop: item.group === firstGroup ? spacing[6] : s(LABEL_TOP),
              }}
            >
              <Text variant="overline" color="textSecondary" accessibilityRole="header">
                {NOTIFICATION_GROUP_LABEL[item.group]}
              </Text>
            </View>
            {/* The label → card gap is a fade rather than more solid band: at rest it lies over
                bare page, and once the label is pinned the cards dissolve under it instead of
                being sliced off at its bottom edge. */}
            <View style={{ height: s(LABEL_BOTTOM) }}>
              <EdgeFade edge="top" heightAt390={LABEL_BOTTOM * 0.75} />
            </View>
          </View>
        );
      }
      return (
        <NotificationRow
          notification={item.row}
          onOpen={actions.openNotification}
          onMarkRead={handleMarkRead}
          onMore={actions.openMenu}
        />
      );
    },
    [actions.openMenu, actions.openNotification, colors, firstGroup, handleMarkRead, s, spacing],
  );

  const status = queryPhase(notifications);
  const firstUse = status === 'success' && list.length === 0;
  const caughtUp = status === 'success' && list.length > 0 && items.length === 0;
  const showMeta = !firstUse && !caughtUp && status === 'success' && unreadCount > 0;

  return (
    <Screen
      padded={false}
      headerStyle={{ paddingHorizontal: spacing.gutter }}
      header={
        <ScreenHeader
          title="Notifications"
          onBack={actions.goBack}
          trailing={
            <IconButton
              icon="Settings01"
              label="Notification preferences"
              onPress={actions.openPreferences}
            />
          }
        />
      }
    >
      {showMeta ? (
        <Animated.View
          exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
          style={[styles.metaRow, { paddingHorizontal: spacing.gutter, marginTop: spacing[6] }]}
        >
          <Text variant="caption" color="textSecondary">
            {pluralize(unreadCount, 'unread', 'unread')}
          </Text>
          <Pressable
            {...a11yButton('Mark all read')}
            feedback="subtle"
            hitSlop={hitSlop8}
            onPress={() => markAllRead.mutate(undefined)}
          >
            <Text variant="captionSemiBold" color="brand" style={styles.link}>
              Mark all read
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {!firstUse ? (
        <Animated.View
          layout={layout}
          style={[
            styles.pills,
            {
              paddingHorizontal: spacing.gutter,
              gap: spacing[2],
              // Without the meta row the pills take its place under the header.
              marginTop: showMeta ? s(PILLS_TOP) : spacing[6],
            },
          ]}
        >
          {NOTIFICATION_FILTERS.map((entry) => (
            <FilterChip
              key={entry.key}
              label={entry.label}
              variant="select"
              selected={filter === entry.key}
              onPress={() => setFilter(entry.key)}
              style={{ paddingHorizontal: s(PILL_PAD_X), paddingVertical: s(PILL_PAD_Y) }}
            />
          ))}
        </Animated.View>
      ) : null}

      <Animated.View layout={layout} style={styles.root}>
        {status === 'pending' ? (
          <View style={{ padding: spacing.gutter, gap: s(CARD_SPACING) }}>
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} height={s(SKELETON_CARD)} radius="card" />
            ))}
          </View>
        ) : status === 'error' ? (
          <StateView
            tone="danger"
            icon="AlertTriangle"
            title="Couldn't load notifications"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void notifications.refetch()}
          />
        ) : firstUse ? (
          <ScrollView
            style={styles.root}
            contentContainerStyle={{
              paddingHorizontal: spacing.gutter,
              paddingBottom: insets.bottom + spacing[8],
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
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={closeOpenSwipeRow}
          />
        )}
      </Animated.View>

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
    </Screen>
  );
}

const useStyles = scaledSheet((s) => ({
  root: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  link: { textDecorationLine: 'underline' },
}));
