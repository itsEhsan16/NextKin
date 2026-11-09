import { View } from 'react-native';

import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import type { NotificationVisual } from '@/data/models';
import { initialOf } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Text } from '@/ui/Text';

import { companyMark } from './companyMark';
import { Icon, dataGlyph, lineBox } from '@/ui/Icon';

/** Feed card tile, drawn at 390: a 46 square slot (Figma 619:43 / 619:65); only a logo is filled. */
const TILE_AT390 = 46;
const RADIUS_AT390 = 12;
/** Owner, 2026-11-09: the line icons and the sparkle stand bare, no tile, and larger (§203). */
const GLYPH_AT390 = 28;
const SPARKLE_SCALE = 1.35;
/** The sparkle export's own box (619:39). */
const SPARKLE_W_AT390 = 22;
const SPARKLE_H_AT390 = 21.5496;
/** The row menu's header tile keeps its smaller 40pt artboard box (NOTIF 03, 95:2899). */
const COMPACT = 40;

const GLYPH_TONE: Record<
  Extract<NotificationVisual, { kind: 'glyph' }>['tone'],
  { fg: ColorToken }
> = {
  brand: { fg: 'brand' },
  success: { fg: 'glyphSuccess' },
  warning: { fg: 'glyphWarm' },
  info: { fg: 'glyphInfo' },
  neutral: { fg: 'iconDefault' },
};

export type VisualTileProps = {
  visual: NotificationVisual;
  /** The row menu's smaller header tile. */
  compact?: boolean;
};

/** The leading tile a feed card and the row menu share (NOTIF 01 redesign, Figma 619:2). */
export function VisualTile({ visual, compact = false }: VisualTileProps) {
  const { colors, radii, s } = useTheme();
  const box = compact ? s(COMPACT) : s(TILE_AT390 / 0.75);
  const glyph = box * (GLYPH_AT390 / TILE_AT390);

  const frame = (bg: ColorToken | null) => ({
    width: box,
    height: box,
    borderRadius: compact ? radii.md : s(RADIUS_AT390 / 0.75),
    ...(bg ? { backgroundColor: colors[bg] } : {}),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });

  if (visual.kind === 'logo') {
    const mark = companyMark(visual.company);
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={`${visual.company} logo`}
        style={frame(mark.bg)}
      >
        <Text variant={compact ? 'logoInitial' : 'notifInitial'} color={mark.fg}>
          {mark.glyph ?? initialOf(visual.company)}
        </Text>
      </View>
    );
  }

  if (visual.kind === 'sparkle') {
    const ratio = (box / TILE_AT390) * SPARKLE_SCALE;
    return (
      <View style={frame(null)}>
        <SparkleIcon width={SPARKLE_W_AT390 * ratio} height={SPARKLE_H_AT390 * ratio} />
      </View>
    );
  }

  const tone = GLYPH_TONE[visual.tone];
  return (
    <View style={frame(null)}>
      <Icon name={dataGlyph(visual.icon)} size={lineBox(glyph)} color={colors[tone.fg]} />
    </View>
  );
}
