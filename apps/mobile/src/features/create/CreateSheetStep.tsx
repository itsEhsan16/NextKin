import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { SheetRow } from '@/ui/SheetRow';
import { Text } from '@/ui/Text';

import { MAX_ROWS, type CreateAction, type CreateRow } from './createSteps';

export type CreateSheetStepProps = {
  title: string;
  rows: readonly CreateRow[];
  onSelect: (action: CreateAction) => void;
  /** Renders the circular back control before the title (CREATE 02). */
  onBack?: () => void;
  footnote?: string;
  /** True while this pane is the one on screen: drives the row stagger and the focus move. */
  visible: boolean;
  style?: StyleProp<ViewStyle>;
};

const BACK_BUTTON = 40;
/**
 * Figma geometry: header row occupies y=30..70 (the back button's box; the 28pt title centres
 * inside it at y=36), the first row tile starts at y=108, and tiles repeat every 88.
 */
const HEADER_HEIGHT = 40;
const HEADER_GAP = 38;
const ROW_GAP = 36;
/** Figma 1:1351 sits at y=368, i.e. 32 below the last 52pt tile at y=284. */
const FOOTNOTE_GAP = 32;

/**
 * One pane of the create sheet. Both steps share this shell so the push between them only
 * ever moves two identical layouts.
 */
export function CreateSheetStep({
  title,
  rows,
  onSelect,
  onBack,
  footnote,
  visible,
  style,
}: CreateSheetStepProps) {
  const { spacing, motion, s } = useTheme();
  const reduced = useReducedMotion();

  // Nothing mounts or unmounts when the steps slide past each other, so a screen reader would
  // otherwise keep focus on a row that just left the tree. Move it to the incoming header —
  // but not on first mount, where the platform already focuses into the freshly opened sheet.
  const headerRef = useRef<View>(null);
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      const node = findNodeHandle(headerRef.current);
      if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
    }
    wasVisible.current = visible;
  }, [visible]);

  if (__DEV__ && rows.length > MAX_ROWS) {
    throw new Error(`Create sheet allows at most ${MAX_ROWS} rows; got ${rows.length}.`);
  }

  return (
    <View style={[{ paddingHorizontal: spacing.gutter }, style]}>
      <View
        ref={headerRef}
        accessible={false}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[4],
          height: s(HEADER_HEIGHT),
        }}
      >
        {onBack ? (
          <IconButton
            icon="chevron-left"
            iconSize={s(14)}
            iconColor="textPrimary"
            label="Back"
            size={s(BACK_BUTTON)}
            variant="filled"
            onPress={onBack}
          />
        ) : null}
        <Text accessibilityRole="header" variant="headline">
          {title}
        </Text>
      </View>

      <View style={{ marginTop: s(HEADER_GAP), gap: s(ROW_GAP) }}>
        {rows.map((row, index) => {
          const content = (
            <SheetRow
              icon={row.icon}
              label={row.label}
              description={row.description}
              ai={row.ai}
              tone={row.tone}
              onPress={() => onSelect(row.key)}
            />
          );
          // Figma motion note 1:1364: "rows stagger in 50–100ms apart".
          return visible && !reduced ? (
            <Animated.View
              key={row.key}
              entering={FadeInDown.delay(index * motion.stagger.row).duration(
                motion.durations.base,
              )}
            >
              {content}
            </Animated.View>
          ) : (
            <View key={row.key}>{content}</View>
          );
        })}
      </View>

      {footnote ? (
        <Text variant="rowDescription" color="textSecondary" style={{ marginTop: s(FOOTNOTE_GAP) }}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}
