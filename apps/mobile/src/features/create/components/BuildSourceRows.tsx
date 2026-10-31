import { View } from 'react-native';

import type { Resume } from '@/data/models';
import { ResumeThumbnail } from '@/features/resumes/components/ResumeThumbnail';
import { a11yButton, a11yHeader, hitSlopFor, pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

// BUILD 01 at 390 (652:2), in artboard units.
const SECTION_GAP = 8 / 0.75; // 652:17
const LINK_GAP = 4.5 / 0.75;
const LINK_H = 16 / 0.75;
const TILE_PAD_X = 15 / 0.75; // 652:63
const TILE_PAD_Y = 16 / 0.75;
const TILE_GAP = 13 / 0.75;
const ICON_TILE = 44 / 0.75; // 652:65
const TEXT_GAP = 2 / 0.75;
const FROM_RADIUS = 14 / 0.75; // 652:70
const FROM_PAD_X = 12 / 0.75;
const FROM_PAD_Y = 10 / 0.75;
const FROM_GAP = 10 / 0.75;
const AVATAR = 34 / 0.75; // 652:71
const PAGE_W = AVATAR * 0.8; // a resume page's 4:5, as TAILOR 01's 32 × 40 thumb
const PAGE_RADIUS = 5 / 0.75;
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
          <Icon name="ChevronRight" size="sm" color={colors.brand} />
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
        <Icon name="Link01" size="md" color={colors.brand} />
      </View>
      <View style={[styles.fill, { gap: s(TEXT_GAP) }]}>
        <Text variant="label">Add a job from anywhere</Text>
        <Text variant="caption" color="textSecondary">
          Paste a link or upload a job description
        </Text>
      </View>
      <Icon name="ChevronRight" size="sm" color={colors.brand} />
    </Pressable>
  );
}

/** What BUILD 01's foot row names: the profile (as the board draws it) or a resume (§139). */
export type BuildFromSource =
  | { kind: 'profile'; name: string; avatarUrl?: string; roles: number; skills: number }
  | { kind: 'resume'; resume: Resume }
  | { kind: 'reading'; fileName: string };

/** "Built from your profile · 4 roles, 12 skills" (652:70) or "Built from <resume>", resume page
 * tile in place of the avatar. */
export function buildFromLabel(source: BuildFromSource): string {
  return source.kind === 'profile'
    ? `Built from your profile · ${pluralize(source.roles, 'role')}, ${pluralize(source.skills, 'skill')}`
    : source.kind === 'resume'
      ? `Built from ${source.resume.title}`
      : `Reading ${source.fileName}…`;
}

/** A resume's page at the avatar's size, for the foot row and the source sheet. */
export function ResumePageTile() {
  const { colors, sizes } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.page, { borderWidth: sizes.border, borderColor: colors.borderDefault }]}>
      <ResumeThumbnail style={styles.fill} />
    </View>
  );
}

/**
 * BUILD 01's foot (652:70): what the resume is built from, with "Change" where the board has
 * "Edit" — the source sheet offers the profile or a resume (toreview §139); the profile is still
 * edited from BUILD 04b's row.
 */
export function BuildFromRow({
  source,
  onChange,
}: {
  source: BuildFromSource;
  onChange: () => void;
}) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.from, { backgroundColor: colors.surfaceFaint }]}>
      {source.kind === 'profile' ? (
        <Avatar source={source.avatarUrl} name={source.name} size={s(AVATAR)} />
      ) : (
        <ResumePageTile />
      )}
      <Text variant="micro" color="textBody" numberOfLines={2} style={styles.fill}>
        {buildFromLabel(source)}
      </Text>
      <Pressable
        {...a11yButton('Change what the resume is built from')}
        feedback="subtle"
        haptic="light"
        hitSlop={hitSlopFor(s(LINK_H))}
        onPress={onChange}
        style={[styles.edit, { backgroundColor: colors.tileBrand }]}
      >
        <Text variant="microBadge" color="brand">
          Change
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
  page: { width: s(PAGE_W), height: s(AVATAR), borderRadius: s(PAGE_RADIUS), overflow: 'hidden' },
  edit: {
    paddingHorizontal: s(EDIT_PAD_X),
    paddingVertical: s(EDIT_PAD_Y),
    borderRadius: s(EDIT_RADIUS),
  },
}));
