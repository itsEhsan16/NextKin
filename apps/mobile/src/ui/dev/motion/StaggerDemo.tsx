import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { DevButton } from '@/ui/dev/DevButton';
import { Text } from '@/ui/Text';

const ROWS = [
  'Tailor resume',
  'Write cover letter',
  'Match a job',
  'Import from LinkedIn',
  'Start blank',
];

/** (c) Rows enter with FadeInDown, each delayed by `stagger.row`. Re-keyed to replay. */
export function StaggerDemo() {
  const { colors, spacing, radii, sizes, motion } = useTheme();
  const reduced = useReducedMotion();
  const [run, setRun] = useState(0);
  const [visible, setVisible] = useState(false);

  const replay = () => {
    setVisible(true);
    setRun((n) => n + 1);
  };

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={[styles.actions, { gap: spacing[2] }]}>
        <DevButton label={visible ? 'Replay' : 'Show rows'} onPress={replay} active />
        <DevButton label="Hide" onPress={() => setVisible(false)} />
      </View>

      {visible ? (
        <View key={run} style={{ gap: spacing[2] }}>
          {ROWS.map((label, i) => (
            <Animated.View
              key={label}
              entering={
                reduced
                  ? undefined
                  : FadeInDown.delay(Math.min(i, motion.stagger.maxItems) * motion.stagger.row)
                      .duration(motion.durations.base)
                      .easing(motion.easings.decelerate)
              }
              style={[
                styles.row,
                {
                  height: sizes.listRow,
                  paddingHorizontal: spacing[4],
                  borderRadius: radii.xl,
                  backgroundColor: colors.surfaceSubtle,
                },
              ]}
            >
              <Text variant="title">{label}</Text>
              <Text variant="caption" color="textTertiary">
                +{i * motion.stagger.row}ms
              </Text>
            </Animated.View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
