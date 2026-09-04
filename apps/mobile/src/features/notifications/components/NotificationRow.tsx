import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Notification } from '@/data/models';
import { formatFeedTime, parseBold, stripBold } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { SwipeableRow } from '@/ui/SwipeableRow';
import { Text } from '@/ui/Text';

import { VisualTile } from './VisualTile';

export type NotificationRowProps = {
  notification: Notification;
  onOpen: (notification: Notification) => void;
  onMarkRead: (notification: Notification) => void;
  onMore: (notification: Notification) => void;
};

const STACKED = 28;
const DOT = 8;

/**
 * One feed row (NOTIF 01/02): rich one-line body, 40pt visual, unread wash + brand dot, and
 * the swipe actions — short swipe reveals Mark read + More, a full swipe commits Mark read
 * (note 1:2600). Long-press opens the same menu as More, so swipe is never the only path.
 */
export const NotificationRow = memo(function NotificationRow({
  notification,
  onOpen,
  onMarkRead,
  onMore,
}: NotificationRowProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();
  const unread = !notification.read;

  const runs = parseBold(notification.body);
  const time = formatFeedTime(notification.createdAt);
  const summary = [stripBold(notification.body), time, unread ? 'unread' : null]
    .filter(Boolean)
    .join(', ');

  return (
    <SwipeableRow
      actions={[
        {
          key: 'read',
          icon: 'check',
          label: 'Mark read',
          tone: 'neutral',
          onPress: () => onMarkRead(notification),
        },
        {
          key: 'more',
          icon: 'ellipsis-h',
          label: 'More',
          tone: 'ink',
          onPress: () => onMore(notification),
        },
      ]}
      onFullSwipe={() => onMarkRead(notification)}
    >
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityHint="Opens this notification. Long press for more actions."
        feedback="subtle"
        haptic="light"
        onPress={() => onOpen(notification)}
        onLongPress={() => onMore(notification)}
        style={{
          backgroundColor: unread ? colors.surfaceUnread : colors.surfacePage,
          paddingLeft: spacing.gutter,
          paddingRight: spacing.gutter + s(12),
          paddingVertical: spacing[4],
        }}
      >
        <View style={[styles.row, { gap: spacing[3] }]}>
          <VisualTile visual={notification.visual} />

          <View style={styles.body}>
            <Text
              variant="body"
              color={unread ? 'textPrimary' : 'textBody'}
              style={styles.bodyText}
            >
              {runs.map((run, index) =>
                run.bold ? (
                  <Text key={index} variant="bodySemiBold" color={unread ? 'textPrimary' : 'textBody'}>
                    {run.text}
                  </Text>
                ) : (
                  run.text
                ),
              )}
            </Text>

            {notification.stack ? (
              <View style={[styles.stack, { marginTop: spacing[2] }]}>
                {[...notification.stack.initials, ...(notification.stack.more ? ['more'] : [])].map(
                  (item, index) => (
                    <View
                      key={`${item}-${index}`}
                      style={[
                        styles.stacked,
                        {
                          width: s(STACKED),
                          height: s(STACKED),
                          borderRadius: s(STACKED) / 2,
                          borderColor: unread ? colors.surfacePage : colors.surfaceCard,
                          backgroundColor:
                            item === 'more' ? colors.borderDefault : colors.surfaceSubtle,
                          marginLeft: index === 0 ? 0 : -s(8),
                        },
                      ]}
                    >
                      <Text variant="micro" color="textBody">
                        {item === 'more' ? `+${notification.stack?.more}` : item}
                      </Text>
                    </View>
                  ),
                )}
                <Text variant="captionSemiBold" style={{ marginLeft: spacing[3] }}>
                  Show all
                </Text>
              </View>
            ) : null}

            <Text variant="captionSm" color="textTertiary" style={{ marginTop: spacing[2] }}>
              {time}
            </Text>
          </View>

          {unread ? (
            <View
              style={[
                styles.dot,
                { width: s(DOT), height: s(DOT), borderRadius: s(DOT) / 2, backgroundColor: colors.brand },
              ]}
            />
          ) : null}
        </View>
      </Pressable>
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          marginLeft: s(76),
          backgroundColor: colors.divider,
        }}
      />
    </SwipeableRow>
  );
});

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  body: { flex: 1 },
  bodyText: { paddingRight: s(8) },
  stack: { flexDirection: 'row', alignItems: 'center' },
  stacked: { borderWidth: s(2), alignItems: 'center', justifyContent: 'center' },
  dot: { marginTop: s(8) },
}));
