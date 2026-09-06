import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { DataExportStatus } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import {
  DATA_EXPORT_CONTENTS,
  dataExportBlock,
  dataExportExpiryLine,
  dataExportFileLine,
} from '../dataExportCopy';

/** The list bullet Job Detail draws (5px dot, gutter to the text). */
const BULLET = 5;
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

  useEffect(() => {
    if (reduced) return;
    sweep.set(withRepeat(withTiming(1, motion.timings.meter), -1, true));
    return () => cancelAnimation(sweep);
  }, [motion.timings.meter, reduced, sweep]);

  const bandStyle = useAnimatedStyle(() => ({ left: `${sweep.value * BAND_TRAVEL}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ text: label }}
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

function Bullet({ label }: { label: string }) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.bulletRow, { gap: spacing[3] }]}>
      <View
        style={{
          width: s(BULLET),
          height: s(BULLET),
          marginTop: spacing[2] + 1,
          borderRadius: radii.full,
          backgroundColor: colors.iconMuted,
        }}
      />
      <Text variant="bulletBody" color="textBody" style={styles.fill}>
        {label}
      </Text>
    </View>
  );
}

export type DataExportStateProps = { status: DataExportStatus };

/** The card the four export states share, plus the contents list when there is a file to describe. */
export function DataExportState({ status }: DataExportStateProps) {
  const { spacing } = useTheme();
  const block = dataExportBlock(status);
  const fileLine = dataExportFileLine(status);
  const expiry = dataExportExpiryLine(status);

  // Idle is asking for the file and ready is taking it — both are moments to know what is inside.
  const showContents = status.status === 'idle' || status.status === 'ready';

  return (
    <View style={{ gap: spacing[6] }}>
      <Card>
        {status.status === 'failed' ? (
          <StateView compact tone="danger" icon="exclamation-triangle" title={block.title} message={block.body} />
        ) : (
          <View style={{ gap: spacing[3] }}>
            <Text variant="headline" accessibilityRole="header">
              {block.title}
            </Text>
            <Text variant="prose" color="textBody">
              {block.body}
            </Text>
            {status.status === 'preparing' ? <IndeterminateBar label={block.title} /> : null}
            {fileLine ? (
              <Text variant="bodySemiBold" style={{ marginTop: spacing[1] }}>
                {fileLine}
              </Text>
            ) : null}
            {expiry ? (
              <Text variant="caption" color="textSecondary">
                {expiry}
              </Text>
            ) : null}
          </View>
        )}
      </Card>

      {showContents ? (
        <View style={{ gap: spacing[3] }}>
          <Text variant="overline" color="textSecondary" accessibilityRole="header">
            WHAT THE FILE HOLDS
          </Text>
          {DATA_EXPORT_CONTENTS.map((line) => (
            <Bullet key={line} label={line} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Block heights for the first status read: the card (34pt of Card padding and hairlines, a 28pt
 * headline, 12pt gap and two 25pt prose lines) over the overline and five bullet lines.
 */
const CARD_BLOCK = 132;
const LINE = 20;
const BULLET_LINE = 23;

/** The loading state. Blocks in the shape of the card that replaces them, never a spinner. */
export function DataExportSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading your data export" style={{ gap: spacing[6] }}>
      <Skeleton height={s(CARD_BLOCK)} radius="cardLg" />
      <View style={{ gap: spacing[3] }}>
        <Skeleton width="45%" height={s(LINE)} />
        {DATA_EXPORT_CONTENTS.map((line) => (
          <Skeleton key={line} height={s(BULLET_LINE)} />
        ))}
      </View>
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  track: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, width: BAND_WIDTH },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  fill: { flex: 1 },
}));
