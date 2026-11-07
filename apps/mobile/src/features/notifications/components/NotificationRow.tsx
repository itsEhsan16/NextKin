import { memo, useMemo } from 'react';
import { View, type AccessibilityActionEvent } from 'react-native';

import type { Notification } from '@/data/models';
import { formatFeedTime, parseBold, stripBold } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { SwipeableRow, type SwipeAction } from '@/ui/SwipeableRow';
import { Text } from '@/ui/Text';

import { companyMark } from './companyMark';
import { VisualTile } from './VisualTile';

export type NotificationRowProps = {
  notification: Notification;
  onOpen: (notification: Notification) => void;
  onMarkRead: (notification: Notification) => void;
  onMore: (notification: Notification) => void;
};

// The card as NOTIF 01's redesign draws it at 390 (Figma 619:44), in artboard units.
const CARD_RADIUS = 16 / 0.75;
const CARD_PAD = 14 / 0.75;
/** Tile → text, and text → dot slot. */
const CARD_GAP = 14 / 0.75;
/** Between the headline, description and time (619:45). */
const LINE_GAP = 3 / 0.75;
/** Extra air the board's spacers add above and below the digest's logo row (619:48 / 619:49). */
const STACK_ABOVE = 6 / 0.75;
const STACK_BELOW = 2 / 0.75;
const STACK_TILE = 26 / 0.75;
const STACK_RADIUS = 7 / 0.75;
const STACK_GAP = 6 / 0.75;
/** The unread dot sits in an 8 × 14 slot, 6 down (619:51). */
const DOT = 8 / 0.75;
const DOT_TOP = 6 / 0.75;
/** Card → card (619:53). */
export const CARD_SPACING = 10 / 0.75;

/**
 * One feed card (NOTIF 01 redesign, Figma 619:2): tile, a headline over a grey line, the time,
 * and a brand dot while unread, when the card also takes the lavender wash and border.
 *
 * Swipe left (note 1:2600): a short swipe reveals Mark read + More, a full swipe commits Mark
 * read. Swipe is never the only path to a control — More (and a long press) open the row menu,
 * which carries Mark as read too, and screen readers get both as accessibility actions. A read
 * card has nothing to mark, so it reveals More alone and a long swipe just rests open.
 */
export const NotificationRow = memo(function NotificationRow({
  notification,
  onOpen,
  onMarkRead,
  onMore,
}: NotificationRowProps) {
  const { colors, sizes, spacing, shadows, s } = useTheme();
  const styles = useStyles();
  const unread = !notification.read;

  const runs = parseBold(notification.body);
  const mixed = runs.some((run) => run.bold);
  const time = formatFeedTime(notification.createdAt);
  const summary = [
    stripBold(notification.body),
    notification.description,
    time,
    unread ? 'unread' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const actions = useMemo<SwipeAction[]>(
    () => [
      ...(unread
        ? [
            {
              key: 'read',
              icon: 'Check' as const,
              label: 'Mark read',
              tone: 'brand' as const,
              onPress: () => onMarkRead(notification),
            },
          ]
        : []),
      {
        key: 'more',
        icon: 'DotsHorizontal' as const,
        label: 'More',
        tone: 'ink' as const,
        onPress: () => onMore(notification),
      },
    ],
    [notification, onMarkRead, onMore, unread],
  );

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'markRead') onMarkRead(notification);
    if (event.nativeEvent.actionName === 'more') onMore(notification);
  };

  return (
    <SwipeableRow
      actions={actions}
      onFullSwipe={unread ? () => onMarkRead(notification) : undefined}
      radius={s(CARD_RADIUS)}
      resetKey={notification.id}
      style={{ marginHorizontal: spacing.gutter, marginBottom: s(CARD_SPACING) }}
    >
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityHint="Opens this notification. Long press for more actions."
        accessibilityActions={[
          ...(unread ? [{ name: 'markRead', label: 'Mark read' }] : []),
          { name: 'more', label: 'More actions' },
        ]}
        onAccessibilityAction={onAccessibilityAction}
        feedback="subtle"
        onPress={() => onOpen(notification)}
        onLongPress={() => onMore(notification)}
        style={[
          styles.card,
          // On the card itself, so the shadow travels with it when the row is swiped.
          shadows.card,
          {
            borderRadius: s(CARD_RADIUS),
            borderWidth: sizes.border,
            borderColor: unread ? colors.unreadBorder : colors.borderSoft,
            backgroundColor: unread ? colors.surfaceUnread : colors.surfaceCard,
          },
        ]}
      >
        <VisualTile visual={notification.visual} />

        <View style={styles.text}>
          {mixed ? (
            <Text variant="notifTitleRun">
              {runs.map((run, index) =>
                run.bold ? (
                  <Text key={index} variant="notifTitle">
                    {run.text}
                  </Text>
                ) : (
                  run.text
                ),
              )}
            </Text>
          ) : (
            <Text variant="notifTitle">{notification.body}</Text>
          )}

          <Text variant="captionRegular" color="textSecondary">
            {notification.description}
          </Text>

          {notification.stack ? (
            <View
              style={[
                styles.stack,
                { marginTop: s(STACK_ABOVE), marginBottom: s(STACK_BELOW), gap: s(STACK_GAP) },
              ]}
            >
              {notification.stack.companies.map((company) => {
                const mark = companyMark(company);
                return (
                  <View
                    key={company}
                    style={[
                      styles.stackTile,
                      {
                        borderWidth: sizes.border,
                        borderColor: colors.borderDefault,
                        backgroundColor: colors[mark.bg],
                      },
                    ]}
                  >
                    <Text variant="notifStackInitial" color={mark.fg}>
                      {mark.glyph ?? company.charAt(0)}
                    </Text>
                  </View>
                );
              })}
              {notification.stack.more ? (
                <View
                  style={[
                    styles.stackTile,
                    styles.stackMore,
                    { backgroundColor: colors.surfaceSubtle },
                  ]}
                >
                  <Text variant="notifStackMore" color="textBody">
                    {`+${notification.stack.more}`}
                  </Text>
                </View>
              ) : null}
              {/* The card itself opens the matches, so this reads as a link but is not a second
                  target (toreview.md 59). */}
              <Text
                variant="captionSemiBold"
                color="brand"
                // 6 of padding on top of the row's 6 gap (619:34).
                style={[styles.showAll, { marginLeft: s(STACK_GAP) }]}
              >
                Show all
              </Text>
            </View>
          ) : null}

          <Text variant="micro" color="textTertiary">
            {time}
          </Text>
        </View>

        <View style={styles.dotSlot}>
          {unread ? <View style={[styles.dot, { backgroundColor: colors.brand }]} /> : null}
        </View>
      </Pressable>
    </SwipeableRow>
  );
});

const useStyles = scaledSheet((s) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: s(CARD_PAD),
    gap: s(CARD_GAP),
  },
  text: { flex: 1, gap: s(LINE_GAP) },
  stack: { flexDirection: 'row', alignItems: 'center' },
  stackTile: {
    width: s(STACK_TILE),
    height: s(STACK_TILE),
    borderRadius: s(STACK_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackMore: { borderRadius: s(STACK_TILE) / 2 },
  showAll: { textDecorationLine: 'underline' },
  dotSlot: { width: s(DOT) },
  dot: { marginTop: s(DOT_TOP), width: s(DOT), height: s(DOT), borderRadius: s(DOT) / 2 },
}));
