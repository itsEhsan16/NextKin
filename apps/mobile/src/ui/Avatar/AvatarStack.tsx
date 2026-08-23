import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type AvatarStackProps = {
  /** Caption after the stack, e.g. "80+ applied". */
  caption?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Three overlapping placeholder avatars (Figma: 24px, 2px white ring, -8 overlap) used as
 * social proof on job cards. Purely decorative until applicant avatars exist in the API.
 */
export function AvatarStack({ caption, size = 24, style }: AvatarStackProps) {
  const { colors, radii, spacing } = useTheme();
  const fills = [colors.avatarStack1, colors.avatarStack2, colors.avatarStack3];
  const overlap = Math.round(size / 3);

  return (
    <View
      accessible={caption != null}
      accessibilityLabel={caption}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }, style]}
    >
      <View style={{ flexDirection: 'row' }}>
        {fills.map((fill, index) => (
          <View
            key={fill}
            style={{
              width: size,
              height: size,
              borderRadius: radii.full,
              backgroundColor: fill,
              borderWidth: 2,
              borderColor: colors.surfaceCard,
              marginLeft: index === 0 ? 0 : -overlap,
            }}
          />
        ))}
      </View>
      {caption ? (
        <Text variant="captionRegular" color="textSecondary">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
