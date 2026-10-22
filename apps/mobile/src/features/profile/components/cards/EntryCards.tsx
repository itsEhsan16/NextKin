import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { EntryTile, type EntryTileContent } from './EntryTile';
import { CARD_RADIUS, ProfileCard } from './ProfileCard';

// The list cards at 390 (PROFILE 04 573:47, PROFILE 12 577:9050), in artboard units.
const CARD_GAP = 10 / 0.75;
const HEADER_GAP = 12 / 0.75;
const LINE_GAP = 2 / 0.75;
const CHEVRON = 9 / 0.75;
const CHIP_GAP = 6 / 0.75;
const CHIP_PAD_X = 10 / 0.75;
const CHIP_PAD_Y = 4 / 0.75;
const ACTION = 36 / 0.75;
const ACTION_GLYPH = 12 / 0.75;
const PILL_PAD_LEFT = 9 / 0.75;
const PILL_PAD_RIGHT = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;
const PILL_GAP = 5 / 0.75;
const PILL_DOT = 6 / 0.75;
const ADD_MIN_HEIGHT = 86 / 0.75;
const ADD_DISC = 40 / 0.75;
const ADD_GLYPH = 14 / 0.75;
const ADD_BORDER = 1 / 0.75;

export type EntryCardProps = {
  tile: EntryTileContent;
  title: string;
  /** The company or school, in the body grey (573:51). */
  subtitle?: string;
  /** The dates, a step quieter (573:52). */
  meta?: string;
  /** "Current" (573:44), at the header's end. */
  pill?: ReactNode;
  /** The skills or field under the header (573:54). */
  chips?: readonly string[];
  /** A second target at the end — the Links list's Open (577:9048). Replaces the chevron. */
  action?: { icon: string; label: string; onPress: () => void };
  onPress: () => void;
};

/**
 * One entry on a profile list. The card opens the entry's editor; a Links card also carries an
 * Open button, which is its own labelled target rather than a hidden half of the card.
 */
export function EntryCard({
  tile,
  title,
  subtitle,
  meta,
  pill,
  chips,
  action,
  onPress,
}: EntryCardProps) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  const summary = [title, subtitle, meta].filter(Boolean).join(', ');

  const header = (
    <View style={styles.header}>
      <EntryTile tile={tile} />
      <View style={styles.text}>
        <Text variant="title" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textBody" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="micro" color="textSecondary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {pill}
      {action ? null : (
        <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.iconChevron} solid />
      )}
    </View>
  );

  const chipRow =
    chips && chips.length > 0 ? (
      <View style={styles.chips}>
        {chips.map((chip) => (
          <View
            key={chip}
            style={[
              styles.chip,
              { borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
            ]}
          >
            <Text variant="micro" color="textBody" numberOfLines={1}>
              {chip}
            </Text>
          </View>
        ))}
      </View>
    ) : null;

  if (action) {
    return (
      <ProfileCard style={[styles.row, { padding: spacing[5] }]}>
        <Pressable
          {...a11yButton(summary, 'Opens this entry')}
          feedback="subtle"
          haptic="light"
          onPress={onPress}
          style={styles.grow}
        >
          {header}
        </Pressable>
        <Pressable
          {...a11yButton(action.label)}
          feedback="scale"
          haptic="light"
          hitSlop={hitSlopFor(s(ACTION))}
          onPress={action.onPress}
          style={[
            styles.action,
            { borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
          ]}
        >
          <FontAwesome5
            name={action.icon}
            size={s(ACTION_GLYPH)}
            color={colors.textPrimary}
            solid
          />
        </Pressable>
      </ProfileCard>
    );
  }

  return (
    <Pressable
      {...a11yButton(
        chips && chips.length > 0 ? `${summary}, ${chips.join(', ')}` : summary,
        'Opens this entry',
      )}
      feedback="subtle"
      haptic="light"
      onPress={onPress}
    >
      <ProfileCard style={{ padding: spacing[5], gap: s(CARD_GAP) }}>
        {header}
        {chipRow}
      </ProfileCard>
    </Pressable>
  );
}

/** A status pill at a card's end — "Current" on the role you hold now (573:44). */
export function StatusPill({
  label,
  tone = 'success',
}: {
  label: string;
  tone?: 'success' | 'danger';
}) {
  const { colors, radii } = useTheme();
  const styles = useStyles();
  const look: { bg: ColorToken; fg: ColorToken; dot: ColorToken } =
    tone === 'success'
      ? { bg: 'successSurface', fg: 'success', dot: 'successIcon' }
      : { bg: 'dangerSurface', fg: 'danger', dot: 'dangerDot' };

  return (
    <View style={[styles.pill, { borderRadius: radii.full, backgroundColor: colors[look.bg] }]}>
      <View
        style={[styles.pillDot, { borderRadius: radii.full, backgroundColor: colors[look.dot] }]}
      />
      <Text variant="microBadge" color={look.fg}>
        {label}
      </Text>
    </View>
  );
}

/** The dashed lavender card that ends a list (573:113): a black plus disc and what it adds. */
export function AddCard({
  title,
  caption,
  onPress,
  style,
}: {
  title: string;
  caption: string;
  onPress: () => void;
  /** Where a board draws the tile at another height — Interview prep's is 90 (577:984). */
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      {...a11yButton(title, caption)}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.add,
        {
          paddingHorizontal: spacing[5],
          borderRadius: s(CARD_RADIUS),
          borderWidth: s(ADD_BORDER),
          borderColor: colors.borderDashed,
          backgroundColor: colors.surfaceNewDoc,
        },
        style,
      ]}
    >
      <View
        style={[styles.disc, { borderRadius: radii.full, backgroundColor: colors.surfaceInverse }]}
      >
        <FontAwesome5 name="plus" size={s(ADD_GLYPH)} color={colors.textOnDark} solid />
      </View>
      <View style={styles.text}>
        <Text variant="title">{title}</Text>
        <Text variant="micro" color="textSecondary">
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: s(HEADER_GAP) },
  text: { flex: 1, gap: s(LINE_GAP) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: s(CHIP_GAP) },
  chip: { paddingHorizontal: s(CHIP_PAD_X), paddingVertical: s(CHIP_PAD_Y) },
  row: { flexDirection: 'row', alignItems: 'center', gap: s(HEADER_GAP) },
  grow: { flex: 1 },
  action: {
    width: s(ACTION),
    height: s(ACTION),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PILL_GAP),
    paddingLeft: s(PILL_PAD_LEFT),
    paddingRight: s(PILL_PAD_RIGHT),
    paddingVertical: s(PILL_PAD_Y),
  },
  pillDot: { width: s(PILL_DOT), height: s(PILL_DOT) },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: s(ADD_MIN_HEIGHT),
    gap: s(HEADER_GAP),
    borderStyle: 'dashed',
  },
  disc: { width: s(ADD_DISC), height: s(ADD_DISC), alignItems: 'center', justifyContent: 'center' },
}));
