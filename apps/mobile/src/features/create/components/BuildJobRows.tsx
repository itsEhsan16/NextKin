import { Fragment, type ReactNode } from 'react';
import { View } from 'react-native';

import type { Job } from '@/data/models';
import { MatchBadge } from '@/features/jobs/components/JobPills';
import { EntryTile, ProfileCard } from '@/features/profile/components/cards';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

import { CheckDisc } from './TailorResumeRows';
import { jobMetaLine } from './TailorVsCard';
import { Icon } from '@/ui/Icon';

// BUILD 01 (652:22 / 652:23) and BUILD 02 (652:100 / 652:101) at 390, in artboard units.
const LIST_PAD = 4.75 / 0.75; // both cards' rows sit 4.75 in from the hairline
const ROW_PAD_X = 14 / 0.75;
const ROW_PAD_Y = 12 / 0.75;
const ROW_GAP = 12 / 0.75;
const LINE_GAP = 3 / 0.75;
const PICK_RADIUS = 16 / 0.75;
const PICK_BORDER = 1 / 0.75;
const RADIO = 22 / 0.75; // 652:101's check tile
const TILE = 40 / 0.75; // EntryTile's md

export type BuildJobRowProps = {
  job: Job;
  /** 'link' opens the comparison on tap (BUILD 01); 'radio' picks the job for the CTA (BUILD 02). */
  variant: 'link' | 'radio';
  selected?: boolean;
  onPress: () => void;
};

/**
 * One saved job (652:23 / 652:101): the letter tile, the title, "Stripe · Bengaluru · Remote" and
 * the match pill under it.
 */
export function BuildJobRow({ job, variant, selected = false, onPress }: BuildJobRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const radio = variant === 'radio';
  const meta = jobMetaLine(job);

  const trailing = radio ? (
    selected ? (
      <CheckDisc />
    ) : (
      <View
        style={[
          styles.radio,
          { borderColor: colors.borderDefault, backgroundColor: colors.surfaceCard },
        ]}
      />
    )
  ) : (
    <Icon name="ChevronRight" size="sm" color={colors.iconChevron} />
  );

  return (
    <Pressable
      accessible
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityLabel={`${job.title}, ${meta}`}
      accessibilityHint={radio ? undefined : 'Compares your profile with this job'}
      accessibilityState={radio ? { selected } : undefined}
      feedback="subtle"
      onPress={onPress}
      style={[
        styles.row,
        radio && styles.pickRow,
        radio && {
          borderColor: selected ? colors.brand : 'transparent',
          backgroundColor: selected ? colors.brandSurface : 'transparent',
        },
      ]}
    >
      <EntryTile tile={{ kind: 'letter', name: job.company }} size="md" />
      <View style={styles.text}>
        <Text variant="label" numberOfLines={1}>
          {job.title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {meta}
        </Text>
        {job.matchBand ? (
          <View style={styles.badge}>
            <MatchBadge band={job.matchBand} />
          </View>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

/**
 * The white card the rows sit in, with hairlines between them (652:22 / 652:100). On BUILD 02 the
 * picked row draws its own brand outline, so no hairline touches it.
 */
export function BuildJobCard({
  children,
  selectedIndex,
}: {
  children: ReactNode[];
  /** The picked row on BUILD 02. */
  selectedIndex?: number;
}) {
  const { colors, sizes } = useTheme();
  const styles = useStyles();
  return (
    <ProfileCard style={styles.listCard}>
      {children.map((child, index) => (
        <Fragment key={index}>
          {index > 0 && index !== selectedIndex && index - 1 !== selectedIndex ? (
            <View style={styles.dividerRow}>
              <View style={{ height: sizes.border, backgroundColor: colors.borderHairline }} />
            </View>
          ) : null}
          {child}
        </Fragment>
      ))}
    </ProfileCard>
  );
}

/** A job row while the list loads: one block, the row's own height (§191). */
export function BuildJobRowSkeleton() {
  const { s } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Skeleton height={s(TILE)} radius="md" style={styles.text} />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  listCard: { padding: s(LIST_PAD) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    paddingHorizontal: s(ROW_PAD_X),
    paddingVertical: s(ROW_PAD_Y),
  },
  // Every radio row keeps the border, so picking one never grows it.
  pickRow: { borderWidth: s(PICK_BORDER), borderRadius: s(PICK_RADIUS) },
  text: { flex: 1, gap: s(LINE_GAP) },
  badge: { alignSelf: 'flex-start' },
  radio: {
    width: s(RADIO),
    height: s(RADIO),
    borderRadius: s(RADIO) / 2,
    borderWidth: s(PICK_BORDER),
  },
  dividerRow: { paddingHorizontal: s(ROW_PAD_X) },
}));
