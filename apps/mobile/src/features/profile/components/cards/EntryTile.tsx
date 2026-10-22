import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import LinkedInArt from '../../../../../assets/icons/create/linkedin.svg';
import { initialOf } from '@/lib';
import { useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

import type { EntryTileSpec } from '../../entryRows';
import { Art } from './ProfileCard';

/**
 * What leads an entry: a company or school's initial on grey (573:42), a link kind's glyph on the
 * brand tint (577:9046), or an illustrated mark that brings its own tile (LinkedIn, 577:9056).
 */
export type EntryTileContent =
  | { kind: 'letter'; name: string }
  | { kind: 'glyph'; icon: string }
  /** A short code on the brand tint — the language sheet's "EN" / "DE" (577:1849). */
  | { kind: 'code'; code: string }
  | { kind: 'art'; art: ListRowArt };

/** LinkedIn's illustrated mark (577:9056), the one tile that is not a letter or a glyph. */
const LINKEDIN_ART: ListRowArt = { Icon: LinkedInArt, w: 37.9905, h: 41.6 };

/** The drawable tile for an entry's data-side tile description. */
export const tileFor = (spec: EntryTileSpec): EntryTileContent =>
  spec.kind === 'linkedin' ? { kind: 'art', art: LINKEDIN_ART } : spec;

/**
 * 36 r10 in the link-kind sheet (577:9800), 38 r11 on a resume entry (577:7103), 40 r12 on a list
 * card, 48 r14 on an editor's identity card (573:153). At 390.
 */
const SIZES = {
  sm: { box: 36, radius: 10, glyph: 15 },
  entry: { box: 38, radius: 11, glyph: 15 },
  md: { box: 40, radius: 12, glyph: 16 },
  lg: { box: 48, radius: 14, glyph: 20 },
} as const;

export function EntryTile({
  tile,
  size = 'md',
}: {
  tile: EntryTileContent;
  size?: keyof typeof SIZES;
}) {
  const { colors, s } = useTheme();
  const metrics = SIZES[size];
  const box = s(metrics.box / 0.75);

  if (tile.kind === 'art') {
    return (
      <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
        <Art art={tile.art} width={metrics.box} />
      </View>
    );
  }

  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: s(metrics.radius / 0.75),
        backgroundColor: tile.kind === 'letter' ? colors.surfaceSubtle : colors.tileBrandStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {tile.kind === 'glyph' ? (
        <FontAwesome5 name={tile.icon} size={s(metrics.glyph / 0.75)} color={colors.brand} solid />
      ) : tile.kind === 'code' ? (
        <Text variant="tileCode" color="brand">
          {tile.code}
        </Text>
      ) : (
        <Text variant={size === 'lg' ? 'entryInitialLg' : 'entryInitial'}>
          {initialOf(tile.name)}
        </Text>
      )}
    </View>
  );
}
