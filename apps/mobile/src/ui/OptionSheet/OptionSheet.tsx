import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import { a11yHeader, hitSlop8 } from '@/lib';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

export type SheetOption<K extends string = string> = {
  key: K;
  label: string;
  /** Muted second line ("Follows your device setting"). */
  caption?: string;
};

export type OptionSheetBodyProps<K extends string = string> = {
  title: string;
  options: readonly SheetOption<K>[];
  selectedKey: K | undefined;
  onSelect: (key: K) => void;
  onClose: () => void;
};

const CHECK = 14;

/**
 * The option list itself — separated from the Sheet so tests can drive it without gestures
 * or animation (the same split FiltersSheetBody uses).
 */
export function OptionSheetBody<K extends string = string>({
  title,
  options,
  selectedKey,
  onSelect,
  onClose,
}: OptionSheetBodyProps<K>) {
  const { colors, sizes, spacing } = useTheme();

  return (
    <View style={{ paddingHorizontal: spacing.gutter, paddingBottom: spacing[4] }}>
      <View style={[styles.header, { paddingVertical: spacing[3] }]}>
        <Text {...a11yHeader(title)} variant="headline">
          {title}
        </Text>
        <IconButton icon="times" label={`Close ${title.toLowerCase()}`} onPress={onClose} />
      </View>

      <View accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option.key === selectedKey;
          return (
            <Pressable
              key={option.key}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              feedback="subtle"
              haptic="selection"
              hitSlop={hitSlop8}
              onPress={() => onSelect(option.key)}
              style={[styles.row, { minHeight: sizes.listRow, gap: spacing[3] }]}
            >
              <View style={styles.labels}>
                <Text variant="rowTitle" numberOfLines={1}>
                  {option.label}
                </Text>
                {option.caption ? (
                  <Text variant="rowDescription" color="textSecondary" numberOfLines={1}>
                    {option.caption}
                  </Text>
                ) : null}
              </View>
              {selected ? (
                <FontAwesome5 name="check" size={CHECK} color={colors.textPrimary} solid />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type OptionSheetProps<K extends string = string> = OptionSheetBodyProps<K> & {
  open: boolean;
};

/** Single-choice picker sheet (Profile → Appearance / Language / Availability / Min salary). */
export function OptionSheet<K extends string = string>({
  open,
  ...body
}: OptionSheetProps<K>) {
  const { sizes } = useTheme();
  return (
    <Sheet
      open={open}
      onClose={body.onClose}
      height={sizes.sheetPickerHeight}
      accessibilityLabel={body.title}
    >
      <OptionSheetBody {...body} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  labels: { flex: 1, gap: 2 },
});
