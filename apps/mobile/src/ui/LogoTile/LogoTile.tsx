import { View, type StyleProp, type ViewStyle } from 'react-native';

import { resolveLogoSvg } from '@/assets';
import { initialOf } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Text } from '@/ui/Text';

export type LogoTileProps = {
  /** Company name — used for the initial fallback and accessibility label. */
  name: string;
  /** Logo URL or `asset:` key. Bundled SVG logos render natively; otherwise an initial tile. */
  logoUrl?: string;
  size?: number;
  /** Tile fill behind the initial. The carousel card tints it brand (Figma 519:5). */
  surface?: ColorToken;
  /** Corner radius, where a board draws one the size steps do not predict. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Artboard sizes: the tile's corner radius steps with it (Figma 40 / 44–48 / 64). */
const DEFAULT_SIZE = 44;
const RADIUS_STEPS = [
  { min: 48, radius: 'xxl' },
  { min: 44, radius: 'lg' },
] as const;

/** Company mark. Figma job cards: 44px, bare logo; unknown companies get an initial tile. */
export function LogoTile({ name, logoUrl, size, surface, radius, style }: LogoTileProps) {
  const { colors, radii, s } = useTheme();
  const box = size ?? s(DEFAULT_SIZE);
  // Compare in device space on both sides, so the step is scale-invariant.
  const step = RADIUS_STEPS.find((entry) => box >= s(entry.min))?.radius ?? 'md';
  const renderLogo = resolveLogoSvg(logoUrl);

  if (renderLogo) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={`${name} logo`}
        style={[{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }, style]}
      >
        {renderLogo({ width: box, height: box })}
      </View>
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${name} logo`}
      style={[
        {
          width: box,
          height: box,
          borderRadius: radius ?? radii[step],
          backgroundColor: colors[surface ?? 'surfaceSubtle'],
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text variant="logoInitial">{initialOf(name)}</Text>
    </View>
  );
}
