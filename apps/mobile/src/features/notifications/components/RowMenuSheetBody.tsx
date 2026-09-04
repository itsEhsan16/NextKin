import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import { categoryMeta, NOTIFICATION_CATEGORIES, type Notification, type NotificationPrefs } from '@/data/models';
import { a11yButton, formatFeedTime, parseBold, stripBold } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { VisualTile } from './VisualTile';

export type RowMenuSheetBodyProps = {
  notification: Notification;
  /** Current prefs — the "You keep …" caption names the categories that stay on. */
  prefs: NotificationPrefs | undefined;
  onMarkRead: () => void;
  onMuteCategory: () => void;
  onDelete: () => void;
};

const ICON = 17;
const ICON_SLOT = 24;
const ROW_HEIGHT = 56;

/** "You keep matches, closing alerts and AI results" (Figma 1:2707). */
export function keepCaption(notification: Notification, prefs: NotificationPrefs | undefined): string {
  const kept = NOTIFICATION_CATEGORIES.filter(
    (meta) => meta.key !== notification.category && (prefs?.categories[meta.key] ?? true),
  ).map((meta) => meta.keepName);
  if (kept.length === 0) return 'Everything else is already off';
  if (kept.length === 1) return `You keep ${kept[0]}`;
  return `You keep ${kept.slice(0, -1).join(', ')} and ${kept[kept.length - 1]}`;
}

type MenuRowProps = {
  icon: string;
  label: string;
  caption?: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
};

function MenuRow({ icon, label, caption, tone = 'default', onPress }: MenuRowProps) {
  const { colors, spacing, s } = useTheme();
  const color: ColorToken = tone === 'danger' ? 'danger' : 'textBody';
  return (
    <Pressable
      {...a11yButton(label, caption)}
      feedback="subtle"
      haptic="light"
      onPress={onPress}
      style={[styles.menuRow, { minHeight: s(ROW_HEIGHT), gap: spacing[3] }]}
    >
      <View style={[styles.iconSlot, { width: s(ICON_SLOT) }]}>
        <FontAwesome5 name={icon} size={s(ICON)} color={colors[color]} solid />
      </View>
      <View style={styles.menuText}>
        <Text variant="menuRow" color={tone === 'danger' ? 'danger' : 'textPrimary'}>
          {label}
        </Text>
        {caption ? (
          <Text variant="captionSm" color="textTertiary">
            {caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * NOTIF 03 (Figma 1:2696) — the per-row sheet behind swipe-More and long-press. Controlled,
 * so tests drive it without the Sheet.
 */
export function RowMenuSheetBody({
  notification,
  prefs,
  onMarkRead,
  onMuteCategory,
  onDelete,
}: RowMenuSheetBodyProps) {
  const { colors, spacing, s } = useTheme();
  const meta = categoryMeta(notification.category);
  const runs = parseBold(notification.body);

  return (
    <View style={{ paddingHorizontal: spacing.gutter }}>
      <View
        accessible
        accessibilityLabel={`${stripBold(notification.body)}, ${meta.singular}, ${formatFeedTime(notification.createdAt)}`}
        style={[styles.header, { gap: spacing[3], paddingVertical: spacing[4] }]}
      >
        <VisualTile visual={notification.visual} />
        <View style={styles.headerText}>
          <Text variant="body" numberOfLines={2}>
            {runs.map((run, index) =>
              run.bold ? (
                <Text key={index} variant="bodySemiBold">
                  {run.text}
                </Text>
              ) : (
                run.text
              ),
            )}
          </Text>
          <Text variant="captionSm" color="textTertiary" style={{ marginTop: s(2) }}>
            {`${meta.singular} · ${formatFeedTime(notification.createdAt)}`}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      <MenuRow icon="check" label="Mark as read" onPress={onMarkRead} />
      <MenuRow
        icon="bell-slash"
        label={`Turn off ${meta.keepName}`}
        caption={keepCaption(notification, prefs)}
        onPress={onMuteCategory}
      />
      <MenuRow icon="trash" label="Delete" tone="danger" onPress={onDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  menuRow: { flexDirection: 'row', alignItems: 'center' },
  // `width` is applied at the call site from s(ICON_SLOT): this sheet is a plain
  // StyleSheet.create, so a raw artboard length here would ship unscaled.
  iconSlot: { alignItems: 'center' },
  menuText: { flex: 1, gap: 0 },
});
