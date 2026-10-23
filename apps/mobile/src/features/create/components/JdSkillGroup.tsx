import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { FilterChip } from '@/ui/Chip';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { layoutTransition } from '@/ui/motion';

/** The three chip groups the review screen edits: §7.5's two skill lists, plus its tools. */
export type SkillGroupKey = 'required' | 'preferred' | 'tools';

export type JdSkillGroupProps = {
  title: string;
  skills: readonly string[];
  /** Names one entry — "required skill", "preferred skill", "tool". */
  noun: string;
  /**
   * Appends the entry. Returns the reason it was refused, or nothing when it went in: the field
   * clears only on a real append, so a duplicate is never a press that silently does nothing.
   */
  onAdd: (skill: string) => string | undefined;
  onPressSkill: (skill: string) => void;
};

/**
 * One editable chip group on the JD review screen (V2 §7.5: skills can be moved between
 * required and preferred, added, or removed).
 *
 * The chips are `picker` chips rather than `removable` ones on purpose. A tap here opens a menu
 * — move or remove — so the chip must not wear a ✕, and `removable` also names itself "Remove
 * filter <label>" to a screen reader, which would be a lie about both the verb and the noun.
 * The hint is overridden for the same reason: what opens is a command menu, not a picker.
 *
 * Each chip is named for its group as well as its skill. Three groups on one page draw the same
 * word twice — "Figma" is a required skill and a tool in the seeded extraction — and a reader
 * moving through them has no other way to tell which list it is landing in.
 */
export function JdSkillGroup({ title, skills, noun, onAdd, onPressSkill }: JdSkillGroupProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const [entry, setEntry] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);

  // Reduced motion drops the transition rather than shortening it: a chip sliding between the
  // two groups is the movement the setting is asking us not to make.
  const layout = layoutTransition(reduced);

  const add = () => {
    const skill = entry.trim();
    if (!skill) return;
    const refused = onAdd(skill);
    setProblem(refused);
    if (!refused) setEntry('');
  };

  return (
    <View style={{ gap: spacing[4] }}>
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
              <FilterChip
                label={skill}
                accessibilityLabel={`${skill}, ${noun}`}
                hint="Opens skill options"
                variant="picker"
                onPress={() => onPressSkill(skill)}
              />
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}

      <View style={[styles.addRow, { gap: spacing[3] }]}>
        <TextField
          value={entry}
          onChangeText={(text) => {
            setEntry(text);
            if (problem) setProblem(undefined);
          }}
          placeholder={`Add a ${noun}`}
          accessibilityLabel={`Add a ${noun}`}
          error={problem}
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
