import { StyleSheet, View } from 'react-native';

import { pluralize } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';

export type FiltersActionBarProps = {
  /** Matches for the draft filters; undefined until the first count resolves or on error. */
  count: number | undefined;
  /** True only for the very first count — a refetch keeps the previous number on screen. */
  loading: boolean;
  onReset: () => void;
  onApply: () => void;
};

const RESET_WIDTH = 140;

/**
 * The sticky Reset / Apply bar (Figma 1:823). Apply carries the live result count, so the label
 * previews what applying the draft would do — "Show 128 jobs" in the artboard.
 *
 * The bar sits outside the scrolling body and the sheet already pads itself by the bottom safe
 * inset, which is the native equivalent of canvas note 1:1043's "sticky bar carries 44px".
 */
export function FiltersActionBar({ count, loading, onReset, onApply }: FiltersActionBarProps) {
  const { colors, spacing, s } = useTheme();

  // Zero is the one state worth disabling: applying it would empty the list on purpose, and Reset
  // is right there. An errored count still applies — a failed preview must not block the action.
  const empty = count === 0;
  const label = loading ? 'Apply filters' : empty ? 'No jobs match' : countLabel(count);

  return (
    <View
      style={[
        styles.bar,
        {
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing[5],
          paddingBottom: spacing[2],
          gap: spacing[3],
          borderTopColor: colors.borderHairline,
          backgroundColor: colors.surfaceSheet,
        },
      ]}
    >
      <Button
        variant="ghost"
        size="lg"
        label="Reset"
        onPress={onReset}
        // The secondary width `StickyActionBar` uses, scaled like every other length.
        style={[styles.reset, { flexBasis: s(RESET_WIDTH) }]}
      />
      <Button
        size="lg"
        label={label}
        loading={loading}
        disabled={empty}
        onPress={onApply}
        style={styles.apply}
      />
    </View>
  );
}

const countLabel = (count: number | undefined): string =>
  count == null ? 'Apply filters' : `Show ${pluralize(count, 'job')}`;

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  reset: { flexGrow: 0, flexShrink: 0, justifyContent: 'center' },
  apply: { flex: 1, justifyContent: 'center' },
});
