import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { atsSectionPassed, type AtsCheckItem, type AtsSection } from '@/data/models';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';
import { StepGlyph, type useRevealStagger } from '@/ui/motion';

export type ScoreSectionProps = {
  section: AtsSection;
  /** Rows stagger in 60ms apart when the score lands; the offset threads across sections. */
  staggerBase: number;
  /**
   * The screen's reveal (`useRevealStagger`): rows enter only in the commit where the score
   * replaces the skeleton, so a revisit or a refetch after a fix does not replay them.
   */
  enter: ReturnType<typeof useRevealStagger>;
  onFix: (item: AtsCheckItem) => void;
};

/** Check 16 / open circle 15 on the 390 board (95:2328 / 95:2336), over 0.75. */
const CHECK = 16 / 0.75;
const PENDING = 15 / 0.75;
/**
 * Vertical rhythm at 390, in artboard units: heading → meter 10 (13), meter → first row 16.25
 * (22), rows on a 38 pitch with a 25.5 box — the Fix pill's height — so 12.5 apart (17).
 */
const METER_TOP = 13;
const ROWS_TOP = 22;
const ROW_GAP = 17;
const ROW_HEIGHT = 34;
/** Glyph → label and label → Fix pill are both 10 at 390. */
const INLINE_GAP = 13;

/**
 * One rubric group of RESUMES 04 (Figma 95:2324–95:2339): heading with "4 of 5", a 4pt meter
 * that turns green when every check passes, then the checklist. Unmet actionable items carry
 * the "Fix" pill.
 */
export function ScoreSection({ section, staggerBase, enter, onFix }: ScoreSectionProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  const passed = atsSectionPassed(section);
  const total = section.items.length;
  const complete = passed === total;

  return (
    <View>
      <View style={[styles.headerRow, { marginBottom: s(METER_TOP) }]}>
        <Text variant="scoreSection" accessibilityRole="header">
          {section.label}
        </Text>
        <Text variant="scoreCount" color={complete ? 'success' : 'textSecondary'}>
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

      <View style={{ gap: s(ROW_GAP), marginTop: s(ROWS_TOP) }}>
        {section.items.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={enter(staggerBase + index)}
            style={[styles.itemRow, { gap: s(INLINE_GAP), minHeight: s(ROW_HEIGHT) }]}
          >
            <View
              accessible
              accessibilityLabel={`${item.label}: ${item.passed ? 'passed' : 'pending'}`}
              style={[styles.itemBody, { gap: s(INLINE_GAP) }]}
            >
              {/* A fix landing turns its circle into a tick that pops in (`StepGlyph`): the
                  "green checks appear the moment a fix lands" promise, seen happening. */}
              <View style={styles.glyph}>
                <StepGlyph
                  state={item.passed ? 'done' : 'todo'}
                  size={s(CHECK)}
                  todoSize={s(PENDING)}
                />
              </View>
              <Text
                variant="scoreCheck"
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
                <Text variant="scoreFix">Fix</Text>
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
  // The open circle is drawn a point narrower than the check; one slot keeps every label on 44.
  glyph: { width: s(CHECK), alignItems: 'center' },
  fixPill: { paddingHorizontal: s(14), paddingVertical: s(5) },
}));
