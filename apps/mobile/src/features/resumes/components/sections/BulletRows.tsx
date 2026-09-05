import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { removeAt, replaceAt } from '../../sectionEdits';

export type BulletRowsProps = {
  /** Namespaces the error keys, so two entries never share one. */
  entryId: string;
  /** The entry this list belongs to, for the screen reader — "Role 1", "Project 2". */
  entryName: string;
  bullets: string[];
  onChange: (bullets: string[]) => void;
  errors: Record<string, string>;
  onBlurField?: (key: string) => void;
};

/**
 * The bullet list under a role or a project (V2 §7.11). Every mutation goes through the pure
 * helpers in `sectionEdits`, so the array surgery is unit-tested rather than inlined here.
 */
export function BulletRows({
  entryId,
  entryName,
  bullets,
  onChange,
  errors,
  onBlurField,
}: BulletRowsProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const layout = reduced ? undefined : LinearTransition.springify();

  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="groupLabel">What you did</Text>

      {bullets.map((bullet, index) => {
        const key = `${entryId}.bullet.${index}`;
        return (
          <Animated.View
            key={key}
            layout={layout}
            entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
            style={[styles.row, { gap: spacing[2] }]}
          >
            <TextField
              value={bullet}
              onChangeText={(text) => onChange(replaceAt(bullets, index, text))}
              onBlur={() => onBlurField?.(key)}
              accessibilityLabel={`${entryName}, bullet ${index + 1}`}
              placeholder="Cut onboarding from five days to two"
              error={errors[key]}
              multiline
              minLines={2}
              style={styles.field}
            />
            <IconButton
              icon="times"
              variant="ghost"
              label={`Remove bullet ${index + 1} of ${entryName}`}
              onPress={() => onChange(removeAt(bullets, index))}
            />
          </Animated.View>
        );
      })}

      <Button
        label="Add bullet"
        variant="ghost"
        icon="plus"
        onPress={() => onChange([...bullets, ''])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  field: { flex: 1 },
});
