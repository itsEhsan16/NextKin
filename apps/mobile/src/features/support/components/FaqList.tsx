import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { FaqItem } from '@/data/models';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Disclosure } from '@/ui/Disclosure';
import { Text } from '@/ui/Text';

export type FaqListProps = {
  items: readonly FaqItem[];
  /** The one open row, or nothing. See `HelpScreen` for why it is one and not many. */
  openId?: string;
  onToggle: (id: string) => void;
};

/** Row inset inside the carded list — the settings-row inset every grouped row uses. */
const ROW_INSET = 19;

/**
 * The FAQ itself (V2 §7.14): one `Disclosure` row per entry, the question as the row title and
 * the answer as prose underneath. Spec-derived — no artboard covers help — so it is the same
 * carded accordion the published score rubric draws.
 */
export function FaqList({ items, openId, onToggle }: FaqListProps) {
  const { colors, motion, s } = useTheme();
  const reduced = useReducedMotion();

  return (
    <Card radius="card" padding={0}>
      {items.map((item, index) => (
        <Animated.View
          key={item.id}
          entering={
            reduced
              ? undefined
              : FadeInDown.delay(
                  Math.min(index, motion.stagger.maxItems) * motion.stagger.row,
                ).duration(motion.durations.base)
          }
        >
          {index > 0 ? (
            <View
              style={[
                styles.divider,
                { marginHorizontal: s(ROW_INSET), backgroundColor: colors.divider },
              ]}
            />
          ) : null}
          <Disclosure
            mode="row"
            title={item.question}
            expanded={openId === item.id}
            onToggle={() => onToggle(item.id)}
            style={{ paddingHorizontal: s(ROW_INSET) }}
          >
            <Text variant="prose" color="textSecondary">
              {item.answer}
            </Text>
          </Disclosure>
        </Animated.View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth },
});
