import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { resolveImageSource } from '@/assets';
import { initialOf } from '@/lib';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type AvatarProps = {
  /** Remote URL or `asset:` key. Falls back to the name initial. */
  source?: string;
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Artboard size; callers pass device-space values, so the default has to be scaled too. */
const DEFAULT_SIZE = 56;

/** Circular user avatar. Figma header: 56px, #e5e7eb backing. */
export function Avatar({ source, name, size, style }: AvatarProps) {
  const { colors, radii, motion, s } = useTheme();
  const box = size ?? s(DEFAULT_SIZE);
  const resolved = resolveImageSource(source);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${name}'s avatar`}
      style={[
        {
          width: box,
          height: box,
          borderRadius: radii.full,
          backgroundColor: colors.borderDefault,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {resolved ? (
        <Image
          source={resolved}
          style={{ width: box, height: box }}
          contentFit="cover"
          recyclingKey={source}
          transition={motion.durations.imageFade}
        />
      ) : (
        <Text variant="logoInitial" color="textSecondary">
          {initialOf(name)}
        </Text>
      )}
    </View>
  );
}
