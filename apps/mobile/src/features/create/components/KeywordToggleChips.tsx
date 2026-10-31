import { View, type StyleProp, type ViewStyle } from 'react-native';

import { hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { KEYWORD_CHIP } from './TailorKeywords';
import { Icon } from '@/ui/Icon';

export type ToggleChipItem = { label: string; on: boolean; quote?: string };

export type KeywordToggleChipsProps = {
  items: readonly ToggleChipItem[];
  onToggle: (label: string, on: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

/** The chip's row height at 390, for the hit slop that takes it to 44pt. */
const CHIP_H = 24 / 0.75;

/**
 * The Customize screen's missing keywords as tap-to-add chips (toreview §114): an amber dashed
 * "+" chip until the user taps it to say they have it, then a filled brand chip with a tick. The
 * drawn TAILOR 02 chip (`KeywordChips`), made pressable; never ticked by default (D-14).
 */
export function KeywordToggleChips({ items, onToggle, style }: KeywordToggleChipsProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.chips, style]}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.on }}
          accessibilityLabel={item.label}
          accessibilityHint={
            item.quote
              ? `The job says: ${item.quote}`
              : item.on
                ? 'Tap to leave it out'
                : 'Tap if you have it'
          }
          feedback="scale"
          haptic="selection"
          hitSlop={hitSlopFor(s(CHIP_H))}
          onPress={() => onToggle(item.label, !item.on)}
          style={[
            styles.chip,
            { borderRadius: radii.full },
            item.on
              ? { backgroundColor: colors.brandSurface, borderColor: colors.brand }
              : { backgroundColor: colors.surfaceCard, borderColor: colors.warningAccent },
            !item.on && styles.dashed,
          ]}
        >
          <Icon
            name={item.on ? 'Check' : 'Plus'}
            size="xs"
            color={item.on ? colors.brand : colors.warningStrong}
          />
          <Text variant="microBadge" color={item.on ? 'brand' : 'warningStrong'} numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: s(KEYWORD_CHIP.gapX),
    rowGap: s(KEYWORD_CHIP.gapY),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(KEYWORD_CHIP.iconGap),
    paddingLeft: s(KEYWORD_CHIP.padLeft),
    paddingRight: s(KEYWORD_CHIP.padRight),
    paddingVertical: s(KEYWORD_CHIP.padY),
    borderWidth: s(KEYWORD_CHIP.dash),
  },
  dashed: { borderStyle: 'dashed' },
}));
