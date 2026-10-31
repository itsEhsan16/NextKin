import { useEffect } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import ExportFileIcon from '../../../../assets/icons/history/export.svg';
import type { DataExportStatus } from '@/data/models';
import { Art, ProfileCard } from '@/features/profile/components/cards';
import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { dataExportBlock, dataExportExpiryLine, dataExportFileLine } from '../dataExportCopy';
import { Icon } from '@/ui/Icon';

// ACCOUNT 03 "File" card at 390 (577:3820), in artboard units.
const FILE_GAP = 12 / 0.75;
const FILE_TILE = 44 / 0.75;
const FILE_TILE_RADIUS = 11.282 / 0.75;
const FILE_LINE_GAP = 4 / 0.75;
const EXPIRY_GAP = 6 / 0.75;
/** The export drawing inside the tile — the History feed's own (577:3823 = history/export). */
const EXPORT_FILE_ART: ListRowArt = { Icon: ExportFileIcon, w: 30.7692, h: 19.0225 };
const EXPORT_FILE_ART_W = 33.8462 / 0.75;
/** Progress-bar geometry, in the artboard's 520 space — the same 8pt bar `ProgressBar` draws. */
const BAR_HEIGHT = 8;
/** The sweeping band, as a share of the track. Percentages, not lengths — nothing to scale. */
const BAND_WIDTH = '38%' as const;
const BAND_TRAVEL = 62;
/** Where reduced motion parks it: the middle of the run the band would otherwise sweep. */
const BAND_PARKED = '31%' as const;

/**
 * V2 §8.5 — the archive's state, said in one card.
 *
 * The progress here is deliberately INDETERMINATE. The export reports no percentage, only a
 * status, so a bar counting to 100 would be a number we invented — and on a legal right that is
 * exactly the wrong place to guess. A band sweeping the track says "still working" and claims
 * nothing; the honest estimate is the sentence beside it.
 */
function IndeterminateBar({ label }: { label: string }) {
  const { colors, radii, motion, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const sweep = useSharedValue(0);
  // The track's width, so the band can travel by transform instead of by `left` — a looping
  // `left` re-laid the bar out on every frame for as long as the export took.
  const trackWidth = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    sweep.set(withRepeat(withTiming(1, motion.timings.meter), -1, true));
    return () => cancelAnimation(sweep);
  }, [motion.timings.meter, reduced, sweep]);

  const bandStyle = useAnimatedStyle(() => ({
    left: 0,
    transform: [{ translateX: (sweep.value * BAND_TRAVEL * trackWidth.value) / 100 }],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ text: label }}
      onLayout={(event: LayoutChangeEvent) => trackWidth.set(event.nativeEvent.layout.width)}
      style={[
        styles.track,
        {
          height: s(BAR_HEIGHT),
          borderRadius: radii.full,
          backgroundColor: colors.progressTrack,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.band,
          { borderRadius: radii.full, backgroundColor: colors.progressFill },
          // Reduced motion parks the band mid-track rather than freezing it at the left edge,
          // where an empty-looking bar would read as "nothing is happening".
          reduced ? { left: BAND_PARKED } : bandStyle,
        ]}
      />
    </View>
  );
}

export type DataExportFileCardProps = { status: DataExportStatus };

/** The built file: its tile, name and size, and when the link expires (ACCOUNT 03 577:3820). */
export function DataExportFileCard({ status }: DataExportFileCardProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  const fileLine = dataExportFileLine(status);
  const expiry = dataExportExpiryLine(status);

  return (
    <ProfileCard style={[styles.fileCard, { padding: spacing[5] }]}>
      <View style={[styles.fileTile, { backgroundColor: colors.tileBrandStrong }]}>
        <Art art={EXPORT_FILE_ART} width={EXPORT_FILE_ART_W} />
      </View>
      <View style={styles.fileText}>
        {fileLine ? <Text variant="label">{fileLine}</Text> : null}
        {expiry ? (
          <View style={styles.expiry}>
            <Icon name="Clock" size="xs" color={colors.textSecondary} />
            <Text variant="micro" color="textSecondary" style={styles.fill}>
              {expiry}
            </Text>
          </View>
        ) : null}
      </View>
    </ProfileCard>
  );
}

/** Building the file: the honest, indeterminate bar on a card of its own. */
export function DataExportPreparingCard({ label }: { label: string }) {
  const { spacing } = useTheme();
  return (
    <ProfileCard style={{ padding: spacing[5] }}>
      <IndeterminateBar label={label} />
    </ProfileCard>
  );
}

/** The export failed; its reason is said verbatim, in the danger tone. */
export function DataExportFailedCard({ status }: { status: DataExportStatus }) {
  const { spacing } = useTheme();
  const block = dataExportBlock(status);
  return (
    <ProfileCard style={{ padding: spacing[5] }}>
      <StateView
        compact
        tone="danger"
        icon="AlertTriangle"
        title={block.title}
        message={block.body}
      />
    </ProfileCard>
  );
}

// Skeleton blocks, ACCOUNT 02 at 390 (577:3071): the hero drawing, its two text lines, the
// section heading and the contents card.
const SKELETON_ART_W = 72 / 0.75;
const SKELETON_ART = 39 / 0.75;
const SKELETON_TITLE = 24 / 0.75;
const SKELETON_LEDE = 35 / 0.75;
const SKELETON_HEADING = 21 / 0.75;
const SKELETON_CARD = 356 / 0.75;

/** The loading state. Blocks in the shape of the idle page that replaces them, never a spinner. */
export function DataExportSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading your data export" style={{ gap: spacing[4] }}>
      <View style={{ alignItems: 'center', gap: spacing[3] }}>
        <Skeleton width={s(SKELETON_ART_W)} height={s(SKELETON_ART)} radius="xl" />
        <Skeleton width="60%" height={s(SKELETON_TITLE)} />
        <Skeleton width="80%" height={s(SKELETON_LEDE)} />
      </View>
      <Skeleton width="45%" height={s(SKELETON_HEADING)} />
      <Skeleton height={s(SKELETON_CARD)} radius="cardLg" />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  track: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, width: BAND_WIDTH },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: s(FILE_GAP) },
  fileTile: {
    width: s(FILE_TILE),
    height: s(FILE_TILE),
    borderRadius: s(FILE_TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileText: { flex: 1, gap: s(FILE_LINE_GAP) },
  expiry: { flexDirection: 'row', alignItems: 'center', gap: s(EXPIRY_GAP) },
  fill: { flex: 1 },
}));
