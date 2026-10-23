import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { a11yButton, a11yHeader, hitSlopFor, pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

// BUILD 01 at 390 (652:2), in artboard units.
const SECTION_GAP = 8 / 0.75; // 652:17
const LINK_GAP = 4.5 / 0.75;
const LINK_CHEVRON = 8 / 0.75;
const LINK_H = 16 / 0.75;
const TILE_PAD_X = 15 / 0.75; // 652:63
const TILE_PAD_Y = 16 / 0.75;
const TILE_GAP = 13 / 0.75;
const ICON_TILE = 44 / 0.75; // 652:65
const ICON_GLYPH = 16 / 0.75;
const TEXT_GAP = 2 / 0.75;
const TILE_CHEVRON = 9 / 0.75;
const FROM_RADIUS = 14 / 0.75; // 652:70
const FROM_PAD_X = 12 / 0.75;
const FROM_PAD_Y = 10 / 0.75;
const FROM_GAP = 10 / 0.75;
const AVATAR = 34 / 0.75; // 652:71
const EDIT_PAD_X = 11 / 0.75; // 652:73
const EDIT_PAD_Y = 5 / 0.75;
const EDIT_RADIUS = 8 / 0.75;

export const BUILD_TITLE = 'Which job is this resume for?';
export const BUILD_LEDE = 'Pick a job and we’ll build your resume for it.';

/** "Your saved jobs  See all (12) ›" (652:17); the link is left out when there is nothing to see. */
export function BuildSectionTitle({
  title,
  linkLabel,
  onLink,
}: {
  title: string;
  linkLabel?: string;
  onLink?: () => void;
}) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text variant="title" style={styles.fill} {...a11yHeader(title)}>
        {title}
      </Text>
      {linkLabel && onLink ? (
        <Pressable
          {...a11yButton(linkLabel, 'Shows every saved job')}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlopFor(s(LINK_H))}
          onPress={onLink}
          style={styles.link}
        >
          <Text variant="microBadge" color="brand">
            {linkLabel}
          </Text>
          <FontAwesome5 name="chevron-right" size={s(LINK_CHEVRON)} color={colors.brand} solid />
        </Pressable>
      ) : null}
    </View>
  );
}

/** "Add a job from anywhere" — the solid lavender tile under the OR (652:63). */
export function BuildAnywhereTile({ onPress }: { onPress: () => void }) {
  const { colors, radii, sizes, s } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton('Add a job from anywhere', 'Paste a link or upload a job description')}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.tile,
        {
          borderRadius: radii.cardLg,
          borderWidth: sizes.border,
          borderColor: colors.brandBorder,
          backgroundColor: colors.brandSurface,
        },
      ]}
    >
      <View
        style={[
          styles.iconTile,
          { borderRadius: radii.full, backgroundColor: colors.tileBrandStrong },
        ]}
      >
        <FontAwesome5 name="link" size={s(ICON_GLYPH)} color={colors.brand} solid />
      </View>
      <View style={[styles.fill, { gap: s(TEXT_GAP) }]}>
        <Text variant="label">Add a job from anywhere</Text>
        <Text variant="caption" color="textSecondary">
          Paste a link or upload a job description
        </Text>
      </View>
      <FontAwesome5 name="chevron-right" size={s(TILE_CHEVRON)} color={colors.brand} solid />
    </Pressable>
  );
}

/** "Built from your profile · 4 roles, 12 skills  Edit" (652:70), at the foot of BUILD 01. */
export function BuildFromProfileRow({
  name,
  avatarUrl,
  roles,
  skills,
  onEdit,
}: {
  name: string;
  avatarUrl?: string;
  roles: number;
  skills: number;
  onEdit: () => void;
}) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.from, { backgroundColor: colors.surfaceFaint }]}>
      <Avatar source={avatarUrl} name={name} size={s(AVATAR)} />
      <Text variant="micro" color="textBody" style={styles.fill}>
        {`Built from your profile · ${pluralize(roles, 'role')}, ${pluralize(skills, 'skill')}`}
      </Text>
      <Pressable
        {...a11yButton('Edit your profile')}
        feedback="subtle"
        haptic="light"
        hitSlop={hitSlopFor(s(LINK_H))}
        onPress={onEdit}
        style={[styles.edit, { backgroundColor: colors.tileBrand }]}
      >
        <Text variant="microBadge" color="brand">
          Edit
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  fill: { flex: 1 },
  section: { flexDirection: 'row', alignItems: 'center', gap: s(SECTION_GAP) },
  link: { flexDirection: 'row', alignItems: 'center', gap: s(LINK_GAP), minHeight: s(LINK_H) },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(TILE_GAP),
    paddingHorizontal: s(TILE_PAD_X),
    paddingVertical: s(TILE_PAD_Y),
  },
  iconTile: {
    width: s(ICON_TILE),
    height: s(ICON_TILE),
    alignItems: 'center',
    justifyContent: 'center',
  },
  from: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(FROM_GAP),
    borderRadius: s(FROM_RADIUS),
    paddingHorizontal: s(FROM_PAD_X),
    paddingVertical: s(FROM_PAD_Y),
  },
  edit: {
    paddingHorizontal: s(EDIT_PAD_X),
    paddingVertical: s(EDIT_PAD_Y),
    borderRadius: s(EDIT_RADIUS),
  },
}));
