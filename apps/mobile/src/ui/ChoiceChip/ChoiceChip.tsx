import { useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress?: () => void;
  /** Shown on but not changeable — a skill already on the profile. */
  locked?: boolean;
  testID?: string;
};

/**
 * A toggle chip (§172): white with a hairline when off, brand-tinted with a check when on.
 * Used for quick answers and for ticking keywords.
 */
export function ChoiceChip({ label, selected, onPress, locked = false, testID }: ChoiceChipProps) {
  const { colors, radii, sizes, u } = useTheme();
  const on = selected || locked;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled: locked }}
      feedback="scale"
      haptic="selection"
      disabled={locked}
      dimDisabled={false}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: u(6),
        minHeight: u(40),
        paddingHorizontal: u(14),
        borderRadius: radii.full,
        borderWidth: sizes.border,
        borderColor: locked ? colors.borderSoft : on ? colors.brand : colors.borderDefault,
        backgroundColor: locked
          ? colors.surfaceSubtle
          : on
            ? colors.brandSurface
            : colors.surfaceCard,
      }}
    >
      {on ? (
        <Icon name="Check" size="xs" color={locked ? colors.textSecondary : colors.brand} />
      ) : null}
      <Text variant="footnote" color={locked ? 'textSecondary' : on ? 'brand' : 'textPrimary'}>
        {label}
      </Text>
    </Pressable>
  );
}
