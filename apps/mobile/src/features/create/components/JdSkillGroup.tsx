import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { FilterChip } from '@/ui/Chip';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

/** The two groups §7.5 splits a JD's skills into, and moves them between. */
export type SkillGroupKey = 'required' | 'preferred';

export type JdSkillGroupProps = {
  title: string;
  skills: readonly string[];
  /** Names this group inside the add field's label — "required", "preferred". */
  kind: string;
  onAdd: (skill: string) => void;
  onPressSkill: (skill: string) => void;
};

/**
 * One editable skill group on the JD review screen (V2 §7.5: skills can be moved between
 * required and preferred, added, or removed).
 *
 * The chips are `picker` chips rather than `removable` ones on purpose. A tap here opens a menu
 * — move or remove — so the chip must not wear a ✕, and `removable` also names itself "Remove
 * filter <label>" to a screen reader, which would be a lie about both the verb and the noun.
 * `picker` announces the skill and hints that it opens one, which is what it does.
 */
export function JdSkillGroup({ title, skills, kind, onAdd, onPressSkill }: JdSkillGroupProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const [entry, setEntry] = useState('');

  // Reduced motion drops the transition rather than shortening it: a chip sliding between the
  // two groups is the movement the setting is asking us not to make.
  const layout = reduced ? undefined : LinearTransition.springify();

  const add = () => {
    const skill = entry.trim();
    if (!skill) return;
    setEntry('');
    onAdd(skill);
  };

  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="section" accessibilityRole="header">
        {title}
      </Text>

      {skills.length > 0 ? (
        <Animated.View layout={layout} style={[styles.chips, { gap: spacing[2] }]}>
          {skills.map((skill) => (
            <Animated.View
              key={skill}
              layout={layout}
              entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
            >
              <FilterChip label={skill} variant="picker" onPress={() => onPressSkill(skill)} />
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}

      <View style={[styles.addRow, { gap: spacing[3] }]}>
        <TextField
          value={entry}
          onChangeText={setEntry}
          placeholder="Add a skill"
          accessibilityLabel={`Add a ${kind} skill`}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmit={add}
          style={styles.field}
        />
        <Button
          label="Add"
          variant="secondary"
          onPress={add}
          disabled={entry.trim().length === 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  addRow: { flexDirection: 'row', alignItems: 'flex-start' },
  field: { flex: 1 },
});
