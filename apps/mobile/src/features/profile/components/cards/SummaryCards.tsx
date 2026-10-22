import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

import { EntryTile, type EntryTileContent } from './EntryTile';
import { Art, ProfileCard } from './ProfileCard';

// Both head cards at 390 (PROFILE 04 573:10, PROFILE 05 573:152), in artboard units.
const MIN_HEIGHT = 100 / 0.75;
const PAD = 16 / 0.75;
const GAP = 14 / 0.75;
const ICON_SLOT_W = 64 / 0.75;
const ICON_SLOT_H = 52 / 0.75;
const SUMMARY_LINE_GAP = 3 / 0.75;
const IDENTITY_LINE_GAP = 2 / 0.75;
const PROGRESS_TOP = 10 / 0.75;
const PROGRESS_H = 6 / 0.75;

export type SummaryCardProps = {
  art: ListRowArt;
  /** The width the board draws the icon at — 58 for most, 56 / 52 for squarer marks. */
  artWidth?: number;
  title: string;
  lede?: string;
  /** Desired roles' "3 of 5" meter (580:1200), in place of a lede. */
  progress?: number;
};

/** The card at the head of a profile list or chip screen: its big icon and where you stand. */
export function SummaryCard({ art, artWidth = 58, title, lede, progress }: SummaryCardProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  return (
    <ProfileCard style={styles.card}>
      <View style={styles.iconSlot}>
        <Art art={art} width={artWidth} />
      </View>
      <View style={styles.text}>
        <Text variant="title">{title}</Text>
        {lede ? (
          <Text variant="micro" color="textSecondary">
            {lede}
          </Text>
        ) : null}
        {progress != null ? (
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              styles.track,
              { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full },
            ]}
          >
            <View
              style={{
                width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`,
                height: s(PROGRESS_H),
                borderRadius: radii.full,
                backgroundColor: colors.surfaceInverse,
              }}
            />
          </View>
        ) : null}
      </View>
    </ProfileCard>
  );
}

export type IdentityCardProps = {
  tile: EntryTileContent;
  title: string;
  /** "Swiggy · Jun 2019 – Feb 2022", or the school over its dates. */
  lines: readonly string[];
};

/** The entry an editor is open on, named at the top of the form (PROFILE 05 573:152). */
export function IdentityCard({ tile, title, lines }: IdentityCardProps) {
  const styles = useStyles();
  return (
    <ProfileCard style={styles.card}>
      <EntryTile tile={tile} size="lg" />
      <View style={[styles.text, styles.identityText]}>
        <Text variant="cardTitle" numberOfLines={2}>
          {title}
        </Text>
        {lines.map((line, index) => (
          <Text
            key={line}
            variant={index === 0 ? 'caption' : 'micro'}
            color="textSecondary"
            numberOfLines={1}
          >
            {line}
          </Text>
        ))}
      </View>
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: s(MIN_HEIGHT),
    padding: s(PAD),
    gap: s(GAP),
  },
  iconSlot: {
    width: s(ICON_SLOT_W),
    height: s(ICON_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(SUMMARY_LINE_GAP) },
  track: { height: s(PROGRESS_H), marginTop: s(PROGRESS_TOP), overflow: 'hidden' },
  identityText: { gap: s(IDENTITY_LINE_GAP) },
}));
