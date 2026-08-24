import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import SparkleIcon from '../../../../assets/icons/ai-sparkle.svg';
import type { NotificationVisual } from '@/data/models';
import { useTheme, type ColorToken } from '@/theme';
import { LogoTile } from '@/ui/LogoTile';

const TILE = 40;

const GLYPH_TONE: Record<'brand' | 'warning' | 'neutral', { bg: ColorToken; fg: ColorToken }> = {
  brand: { bg: 'brandSurface', fg: 'brand' },
  warning: { bg: 'warningSurface', fg: 'warningStrong' },
  neutral: { bg: 'surfaceSubtle', fg: 'textBody' },
};

/** The 40pt leading tile a feed row and the row menu share (Figma 1:2423/1:2439/1:2446). */
export function VisualTile({ visual }: { visual: NotificationVisual }) {
  const { colors, radii } = useTheme();

  if (visual.kind === 'logo') return <LogoTile name={visual.company} size={TILE} />;

  const tone = visual.kind === 'sparkle' ? GLYPH_TONE.brand : GLYPH_TONE[visual.tone];
  return (
    <View
      style={{
        width: TILE,
        height: TILE,
        borderRadius: radii.md,
        backgroundColor: colors[tone.bg],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {visual.kind === 'sparkle' ? (
        <SparkleIcon width={16} height={16} color={colors.brand} />
      ) : (
        <FontAwesome5 name={visual.icon} size={16} color={colors[tone.fg]} solid />
      )}
    </View>
  );
}
