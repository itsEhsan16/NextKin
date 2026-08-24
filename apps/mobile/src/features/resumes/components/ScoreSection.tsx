import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { atsSectionPassed, type AtsCheckItem, type AtsSection } from '@/data/models';
import { a11yButton, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type ScoreSectionProps = {
  section: AtsSection;
  /** Rows stagger in 60ms apart on first paint; the offset threads across sections. */
  staggerBase: number;
  onFix: (item: AtsCheckItem) => void;
};

const CHECK = 15;
const PENDING = 14;

/**
 * One rubric group of RESUMES 04 (Figma 1:2123–1:2178): heading with "4 of 5", a 4pt meter
 * that turns green when every check passes, then the checklist. Unmet actionable items carry
 * the "Fix" pill.
 */
export function ScoreSection({ section, staggerBase, onFix }: ScoreSectionProps) {
  const { colors, motion, radii, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  const passed = atsSectionPassed(section);
  const total = section.items.length;
  const complete = passed === total;

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={styles.headerRow}>
        <Text variant="label" accessibilityRole="header">
          {section.label}
        </Text>
        <Text variant="caption" color={complete ? 'success' : 'textSecondary'}>
          {`${passed} of ${total}`}
        </Text>
      </View>

      <ProgressBar
        value={total > 0 ? passed / total : 0}
        height={s(4)}
        trackColor="surfaceSubtle"
        fillColor={complete ? 'success' : 'surfaceInverse'}
        accessibilityLabel={`${section.label}: ${passed} of ${total} checks passed`}
      />

      <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
        {section.items.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={
              reduced
                ? undefined
                : FadeInDown.delay(
                    Math.min(staggerBase + index, motion.stagger.maxItems) * motion.stagger.row,
                  ).duration(motion.durations.base)
            }
            style={[styles.itemRow, { gap: spacing[3], minHeight: s(28) }]}
          >
            <View
              accessible
              accessibilityLabel={`${item.label}: ${item.passed ? 'passed' : 'pending'}`}
              style={[styles.itemBody, { gap: spacing[3] }]}
            >
              <FontAwesome5
                name={item.passed ? 'check-circle' : 'circle'}
                size={item.passed ? CHECK : PENDING}
                color={item.passed ? colors.success : colors.borderDashed}
                solid={item.passed}
              />
              <Text
                variant="rowLabel"
                color={item.passed ? 'textBody' : 'textPrimary'}
                style={styles.itemLabel}
              >
                {item.label}
              </Text>
            </View>
            {!item.passed && item.fixable ? (
              <Pressable
                {...a11yButton(`Fix: ${item.label}`, 'Opens the AI fix flow')}
                feedback="subtle"
                haptic="selection"
                onPress={() => onFix(item)}
                style={[
                  styles.fixPill,
                  { borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
                ]}
              >
                <Text variant="microSemiBold">Fix</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemBody: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  itemLabel: { flex: 1 },
  fixPill: { paddingHorizontal: s(14), paddingVertical: s(5) },
}));
