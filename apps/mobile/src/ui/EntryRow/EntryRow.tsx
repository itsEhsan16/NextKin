import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon, type LineIconName } from '@/ui/Icon';

export type EntryRowProps = {
  /** Untitled UI line icon. */
  icon: LineIconName;
  title: string;
  /** The muted second line — "Flipkart · Mar 2022 – Present". */
  meta?: string;
  /** A third line of tags. Capped by `maxTags`; the rest collapse into a "+N" chip. */
  tags?: readonly string[];
  maxTags?: number;
  showChevron?: boolean;
  onPress: () => void;
  /** Overrides the default "title, meta, tags" reading. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** Shared with `ListRow` so the two row shapes sit on one grid and one divider inset. */
const ICON_SLOT = 20;
const PADDING_X = 20;
const GUTTER = 16;
const DEFAULT_MAX_TAGS = 3;

/**
 * A row whose title needs a line of its own: a title, a muted meta line, and optionally a line of
 * tags.
 *
 * It exists because `ListRow`'s `value` is a *trailing* value — "4 roles", "System", "₹24L" — and
 * handing it a subtitle is what emptied the profile lists on a phone. `flex: 1` gives the label
 * `flexBasis: 0`, Yoga defaults `flexShrink` to 0, so a long value could not shrink and the label
 * resolved to width 0: the education degree rendered no glyphs at all. Here the two lines are
 * stacked and clamp independently, so neither can starve the other at any width.
 *
 * The same shape had already been hand-rolled six times (the resume pickers on Tailor, ATS check,
 * cover letter and interview setup; the contact form's topic row; `OptionSheet`'s options). This
 * is that shape, once.
 */
export function EntryRow({
  icon,
  title,
  meta,
  tags,
  maxTags = DEFAULT_MAX_TAGS,
  showChevron = true,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: EntryRowProps) {
  const { colors, sizes, spacing, s } = useTheme();
  const styles = useStyles();

  const shown = tags?.slice(0, maxTags) ?? [];
  const overflow = (tags?.length ?? 0) - shown.length;

  // One focus stop reading the whole row, so a screen reader is not walked through three chips to
  // learn what the entry is.
  const spoken = accessibilityLabel ?? [title, meta, ...(tags ?? [])].filter(Boolean).join(', ');

  return (
    <Pressable
      {...a11yButton(spoken)}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      feedback="subtle"
      haptic="light"
      onPress={onPress}
      style={[
        styles.row,
        {
          minHeight: sizes.listRow,
          paddingHorizontal: s(PADDING_X),
          paddingVertical: spacing[3],
          gap: s(GUTTER),
        },
        style,
      ]}
    >
      <View style={[styles.iconSlot, { width: s(ICON_SLOT) }]}>
        <Icon name={icon} size="sm" color={colors.iconDefault} />
      </View>

      <View style={styles.body}>
        <Text variant="rowTitle" numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text variant="rowDescription" color="textSecondary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {shown.length > 0 ? (
          // Hidden from the reader: the row's own label already says the tags, and three chips
          // would otherwise be three more stops on the way past one entry.
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.tags, { gap: spacing[1], marginTop: spacing[1] }]}
          >
            {shown.map((tag) => (
              <Chip key={tag} label={tag} labelVariant="captionSm" />
            ))}
            {overflow > 0 ? <Chip label={`+${overflow}`} labelVariant="captionSm" /> : null}
          </View>
        ) : null}
      </View>

      {showChevron ? <Icon name="ChevronRight" size="sm" color={colors.iconChevron} /> : null}
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconSlot: { alignItems: 'center' },
  /** `flex: 1` with the lines stacked — the fix for the starvation described above. */
  body: { flex: 1, gap: s(2) },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
}));
