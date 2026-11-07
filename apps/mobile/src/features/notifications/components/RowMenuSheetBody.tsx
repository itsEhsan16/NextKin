import type { FC } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import MarkReadIcon from '../../../../assets/icons/create/ats-check.svg';
import DeleteIcon from '../../../../assets/icons/notif-menu/delete.svg';
import MuteIcon from '../../../../assets/icons/notif-menu/mute.svg';

import {
  categoryMeta,
  NOTIFICATION_CATEGORIES,
  type Notification,
  type NotificationPrefs,
} from '@/data/models';
import { a11yButton, formatFeedTime, parseBold, stripBold } from '@/lib';
import { useTheme } from '@/theme';
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

/**
 * Each action leads with a 39-wide illustrated icon (Figma 505:10 / 505:26 / 505:49) on a 56
 * pitch at 390: 52 wide, 8.5 above and below — 11⅓ in artboard units. "Mark as read" is the
 * ATS-check art, drawn 38 tall; the other two are square tiles.
 */
const ICON = 52;
const ROW_PAD = (56 - 39) / 2 / 0.75;
/** The respaced board (toreview.md 38.1): meta line +8⅔, header → divider +4⅔, divider → rows 9⅓. */
const META_TOP = 2 + 6.5 / 0.75;
const HEADER_BOTTOM_EXTRA = 3.5 / 0.75;
const ROWS_TOP = 7 / 0.75;

type MenuIcon = { Icon: FC<SvgProps>; h: number };

const ICONS = {
  markRead: { Icon: MarkReadIcon, h: 38.0029 / 0.75 },
  mute: { Icon: MuteIcon, h: ICON },
  delete: { Icon: DeleteIcon, h: ICON },
} satisfies Record<string, MenuIcon>;

/** "You keep matches, closing alerts and AI results" (Figma 1:2707). */
export function keepCaption(
  notification: Notification,
  prefs: NotificationPrefs | undefined,
): string {
  const kept = NOTIFICATION_CATEGORIES.filter(
    (meta) => meta.key !== notification.category && (prefs?.categories[meta.key] ?? true),
  ).map((meta) => meta.keepName);
  if (kept.length === 0) return 'Everything else is already off';
  if (kept.length === 1) return `You keep ${kept[0]}`;
  return `You keep ${kept.slice(0, -1).join(', ')} and ${kept[kept.length - 1]}`;
}

type MenuRowProps = {
  icon: MenuIcon;
  label: string;
  caption?: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
};

function MenuRow({ icon, label, caption, tone = 'default', onPress }: MenuRowProps) {
  const { sizes, spacing, s } = useTheme();
  return (
    <Pressable
      {...a11yButton(label, caption)}
      feedback="subtle"
      onPress={onPress}
      // `sizes.listRow`, not the drawn 56. A local constant is scaled by the flat factor and so
      // landed at 42dp on a phone — under the 44pt floor, and read as cramped on a device. The
      // token is read between the two artboards (see CONTROL_AT390) and clears the floor.
      style={[
        styles.menuRow,
        { minHeight: sizes.listRow, paddingVertical: s(ROW_PAD), gap: spacing[4] },
      ]}
    >
      <View style={[styles.iconSlot, { width: s(ICON) }]}>
        <icon.Icon width={s(ICON)} height={s(icon.h)} />
      </View>
      <View style={[styles.menuText, { gap: s(2) }]}>
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
 * NOTIF 03 (Figma 95:2897) — the per-row sheet behind swipe-More and long-press. Controlled,
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
        style={[
          styles.header,
          {
            gap: spacing[3],
            paddingTop: spacing[4],
            paddingBottom: spacing[4] + s(HEADER_BOTTOM_EXTRA),
          },
        ]}
      >
        <VisualTile visual={notification.visual} compact />
        <View style={styles.headerText}>
          {/* A plain headline is bold throughout on the card, so it is semibold here (619:46). */}
          <Text variant={runs.some((run) => run.bold) ? 'body' : 'bodySemiBold'} numberOfLines={2}>
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
          <Text variant="captionSm" color="textTertiary" style={{ marginTop: s(META_TOP) }}>
            {`${meta.singular} · ${formatFeedTime(notification.createdAt)}`}
          </Text>
        </View>
      </View>

      <View
        style={[styles.divider, { backgroundColor: colors.divider, marginBottom: s(ROWS_TOP) }]}
      />

      <MenuRow icon={ICONS.markRead} label="Mark as read" onPress={onMarkRead} />
      <MenuRow
        icon={ICONS.mute}
        label={`Turn off ${meta.keepName}`}
        caption={keepCaption(notification, prefs)}
        onPress={onMuteCategory}
      />
      <MenuRow icon={ICONS.delete} label="Delete" tone="danger" onPress={onDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The type tile now sits on the first line of the body, not centred on the block (95:2899).
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  menuRow: { flexDirection: 'row', alignItems: 'center' },
  // `width` is applied at the call site from s(ICON_SLOT): this sheet is a plain
  // StyleSheet.create, so a raw artboard length here would ship unscaled.
  iconSlot: { alignItems: 'center', justifyContent: 'center' },
  // The `gap` is applied at the call site: a caption jammed against its label was the other half
  // of what read as clustered on a device.
  menuText: { flex: 1 },
});
