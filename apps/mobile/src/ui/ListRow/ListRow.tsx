import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type ListRowProps = {
  /** FontAwesome 5 Free Solid glyph name. */
  icon: string;
  label: string;
  /** Muted trailing value ("4 roles", "System", "₹24L"). */
  value?: string;
  /** Danger rows (Delete account) tint the icon and label. */
  tone?: 'default' | 'danger';
  showChevron?: boolean;
  onPress: () => void;
  /** Overrides the default "label, value" reading. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const ICON = 16;
const ICON_SLOT = 20;
const CHEVRON = 11;
/** Figma 1:2239: icon at x19, label at x55 → the divider inset below. */
const PADDING_X = 19;
const GUTTER = 16;
const DIVIDER_INSET = PADDING_X + ICON_SLOT + GUTTER;

/**
 * 58pt grouped-settings row (Figma PROFILE 01/02): leading glyph, 17pt medium label, muted
 * value, chevron. Compose inside a `RowGroup` for the carded groups with inset dividers.
 */
export function ListRow({
  icon,
  label,
  value,
  tone = 'default',
  showChevron = true,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ListRowProps) {
  const { colors, sizes, spacing, s } = useTheme();
  const danger = tone === 'danger';

  return (
    <Pressable
      {...a11yButton(accessibilityLabel ?? (value ? `${label}, ${value}` : label))}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      feedback="subtle"
      haptic="light"
      onPress={onPress}
      style={[
        styles.row,
        { minHeight: sizes.listRow, paddingHorizontal: s(PADDING_X), gap: s(GUTTER) },
        style,
      ]}
    >
      <View style={styles.iconSlot}>
        <FontAwesome5
          name={icon}
          size={s(ICON)}
          color={danger ? colors.danger : colors.iconDefault}
          solid
        />
      </View>
      <Text
        variant="rowTitle"
        color={danger ? 'danger' : 'textPrimary'}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Text>
      {value ? (
        <Text variant="segment" color="textSecondary" numberOfLines={1} style={{ marginRight: spacing[1] }}>
          {value}
        </Text>
      ) : null}
      {showChevron ? (
        <FontAwesome5 name="chevron-right" size={s(CHEVRON)} color={colors.iconChevron} solid />
      ) : null}
    </Pressable>
  );
}

export type RowGroupProps = {
  /** Overline printed above the card ("CAREER PROFILE"). */
  title?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Carded row group (r20 hairline card) with hairline dividers inset past the icon column,
 * exactly as the artboard insets them (x=55).
 */
export function RowGroup({ title, children, style }: RowGroupProps) {
  const { colors, spacing, s } = useTheme();
  const rows = Array.isArray(children) ? children : [children];

  return (
    <View style={[{ gap: spacing[2] + 4 }, style]}>
      {title ? (
        <Text variant="overline" color="textSecondary" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Card radius="card" padding={0}>
        {rows.filter(Boolean).map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  marginLeft: s(DIVIDER_INSET),
                  backgroundColor: colors.divider,
                }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconSlot: { width: ICON_SLOT, alignItems: 'center' },
  label: { flex: 1 },
});
