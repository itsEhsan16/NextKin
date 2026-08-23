import { View, type StyleProp, type ViewStyle } from 'react-native';

import { resolveLogoSvg } from '@/assets';
import { initialOf } from '@/lib';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type LogoTileProps = {
  /** Company name — used for the initial fallback and accessibility label. */
  name: string;
  /** Logo URL or `asset:` key. Bundled SVG logos render natively; otherwise an initial tile. */
  logoUrl?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Company mark. Figma job cards: 44px, bare logo; unknown companies get an initial tile. */
export function LogoTile({ name, logoUrl, size = 44, style }: LogoTileProps) {
  const { colors, radii } = useTheme();
  const renderLogo = resolveLogoSvg(logoUrl);

  if (renderLogo) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={`${name} logo`}
        style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      >
        {renderLogo({ width: size, height: size })}
      </View>
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${name} logo`}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size >= 48 ? radii.xxl : size >= 44 ? radii.lg : radii.md,
          backgroundColor: colors.surfaceSubtle,
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
