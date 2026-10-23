import { memo } from 'react';
import { View } from 'react-native';

import { ACTIVITY_KIND_LABEL, type ActivityEntry } from '@/data/models';
import { Art, ProfileCard } from '@/features/profile/components/cards';
import { formatFeedTime, parseBold, stripBold } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { ACTIVITY_TILE_ART } from '../historyArt';

export type ActivityRowProps = {
  entry: ActivityEntry;
  onOpen: (entry: ActivityEntry) => void;
};

// One activity card at 390 (HISTORY 01 580:3012), in artboard units.
const PAD = 14 / 0.75;
const GAP = 12 / 0.75;
const TILE = 40 / 0.75;
const TILE_RADIUS = 10.5 / 0.75;
const TEXT_GAP = 4 / 0.75;
const META_GAP = 10 / 0.75;

/** The 40pt leading tile: a whole drawing, or a drawing on the lavender tile (580:3013). */
function ActivityTile({ entry }: { entry: ActivityEntry }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const look = ACTIVITY_TILE_ART[entry.kind];

  if (look.kind === 'tile') {
    return (
      <View style={styles.tile}>
        <Art art={look.art} width={TILE * 0.75} />
      </View>
    );
  }
  return (
    <View style={[styles.tile, styles.framed, { backgroundColor: colors.tileBrandStrong }]}>
      <Art art={look.art} width={look.width} />
    </View>
  );
}

/**
 * One card of the History feed (HISTORY 01): the kind's drawing, one rich line with its bold
 * runs, then the quiet detail with the time at the far end. No unread state and no swipe, because
 * this is an append-only audit trail and nothing on it is yours to mark or delete.
 *
 * A card with no destination (a run that produced nothing to open) is plain. It is not a
 * Pressable that goes nowhere, and it does not look like one.
 */
export const ActivityRow = memo(function ActivityRow({ entry, onOpen }: ActivityRowProps) {
  const styles = useStyles();
  const runs = parseBold(entry.title);
  const time = formatFeedTime(entry.createdAt);
  const summary = [ACTIVITY_KIND_LABEL[entry.kind], stripBold(entry.title), entry.detail, time]
    .filter(Boolean)
    .join(', ');

  const body = (
    <ProfileCard style={styles.card}>
      <ActivityTile entry={entry} />
      <View style={styles.text}>
        <Text variant="menuRow" color="textBody">
          {runs.map((run, index) =>
            run.bold ? (
              <Text key={index} variant="label" color="textPrimary">
                {run.text}
              </Text>
            ) : (
              run.text
            ),
          )}
        </Text>
        <View style={styles.meta}>
          <Text variant="micro" color="textSecondary" style={styles.detail}>
            {entry.detail ?? ''}
          </Text>
          <Text variant="micro" color="textTertiary">
            {time}
          </Text>
        </View>
      </View>
    </ProfileCard>
  );

  return entry.deepLink ? (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={summary}
      accessibilityHint="Opens what this was about"
      feedback="scale"
      haptic="light"
      onPress={() => onOpen(entry)}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={summary}>
      {body}
    </View>
  );
});

const useStyles = scaledSheet((s) => ({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: s(GAP), padding: s(PAD) },
  tile: { width: s(TILE), height: s(TILE), alignItems: 'center', justifyContent: 'center' },
  framed: { borderRadius: s(TILE_RADIUS) },
  text: { flex: 1, gap: s(TEXT_GAP) },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: s(META_GAP) },
  detail: { flex: 1 },
}));
