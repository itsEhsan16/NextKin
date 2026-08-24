import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, hitSlop8 } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type StateViewProps = {
  /** FA5 glyph shown in the tile. */
  icon: string;
  /** Solid (default) or Regular outline set — JOBS 07 draws the bookmark as an outline. */
  iconStyle?: 'solid' | 'regular';
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Quieter text action under the primary button (JOBS 06 "Clear all filters", 1:964). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  tone?: 'neutral' | 'danger';
  /** Compact inline variant for section-level states (inside cards). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Empty / error state. The full variant mirrors the Figma empty screens (96px r28 icon
 * tile); `compact` fits inside a section card.
 *
 * Accessibility: the container is deliberately NOT `accessible`. Marking it accessible
 * collapses the whole subtree into one element, which swallows the action Button — and on a
 * page-level error state that button is the only recovery path. Instead the title carries the
 * full description (title + message) and the decorative icon / duplicated message are hidden,
 * so a screen reader reads one summary and then reaches the Button as its own element.
 */
export function StateView({
  icon,
  iconStyle = 'solid',
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  tone = 'neutral',
  compact = false,
  style,
}: StateViewProps) {
  const { colors, radii, sizes, spacing } = useTheme();
  const tile = compact ? 48 : sizes.emptyStateTile;

  return (
    <View
      style={[
        {
          alignItems: 'center',
          paddingVertical: compact ? spacing[4] : spacing[10],
          gap: compact ? spacing[2] : spacing[3],
        },
        style,
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: tile,
          height: tile,
          borderRadius: compact ? radii.xl : radii.emptyTile,
          backgroundColor: tone === 'danger' ? colors.dangerSurface : colors.surfaceSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FontAwesome5
          name={icon}
          size={compact ? 18 : 32}
          color={tone === 'danger' ? colors.danger : colors.iconDefault}
          solid={iconStyle === 'solid'}
        />
      </View>
      <Text
        variant={compact ? 'title' : 'headline'}
        align="center"
        accessibilityRole="summary"
        accessibilityLabel={message ? `${title}. ${message}` : title}
      >
        {title}
      </Text>
      {message ? (
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ maxWidth: 300 }}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant={tone === 'danger' ? 'secondary' : 'primary'}
          style={{ marginTop: spacing[2] }}
        />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Pressable
          {...a11yButton(secondaryLabel)}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlop8}
          onPress={onSecondary}
          style={{ marginTop: spacing[2] }}
        >
          <Text variant="segmentActive" color="textSecondary" align="center">
            {secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
