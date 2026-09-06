import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { SKILL_SUGGESTIONS } from '@/data/models';
import { a11yButton, hitSlopFor, pluralize, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { FilterChip } from '@/ui/Chip';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { addRoleSkill, removeRoleSkill } from '../../profileForms';

/** FilterChip's `removable` metrics, so this chip is that chip — see the note on the component. */
const PADDING_X = 13;
const PADDING_Y = 6;
const TIMES = 9;
const CHIP_HEIGHT = 32;

/** Enough to be useful under one field; more turns the form into a directory. */
const MAX_SUGGESTIONS = 4;

/**
 * One skill on this role.
 *
 * Deliberately not `FilterChip variant="removable"`: that variant draws exactly this box, but it
 * names itself "Remove filter <label>" to a screen reader, and a skill is not a filter. The
 * metrics above are copied from it so the two read as the same chip on the page — the same
 * trade-off `resumes/components/sections/StringListEditor` made.
 */
function SkillChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { colors, radii, spacing, s } = useTheme();

  return (
    <Pressable
      {...a11yButton(`${label}, skill`, `Removes ${label} from this role`)}
      feedback="subtle"
      haptic="selection"
      hitSlop={hitSlopFor(s(CHIP_HEIGHT))}
      onPress={onRemove}
      style={[
        styles.chip,
        {
          borderRadius: radii.full,
          gap: spacing[1] + 2,
          paddingHorizontal: s(PADDING_X),
          paddingVertical: s(PADDING_Y),
          backgroundColor: colors.surfaceCard,
          borderWidth: s(1),
          borderColor: colors.borderDefault,
        },
      ]}
    >
      <Text variant="caption" color="textBody" numberOfLines={1}>
        {label}
      </Text>
      <FontAwesome5 name="times" size={s(TIMES)} color={colors.iconMuted} solid />
    </Pressable>
  );
}

export type SkillChipsFieldProps = {
  value: string[];
  onChange: (skills: string[]) => void;
};

/**
 * The skills this role is where you used them (V2 §7.3 — `Experience.skills`). The same chip
 * shape the résumé section editor uses, plus the shipped vocabulary underneath: typing narrows
 * it, so the common spelling of a skill is one tap rather than a guess.
 *
 * An empty list is not an error state — the add row IS the empty state.
 */
export function SkillChipsField({ value, onChange }: SkillChipsFieldProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const [entry, setEntry] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);

  // Dropped rather than shortened under reduced motion: a chip sliding into place is the
  // movement the setting asks us not to make.
  const layout = reduced ? undefined : LinearTransition.springify();

  const typed = entry.trim().toLowerCase();
  const suggestions = SKILL_SUGGESTIONS.filter(
    (skill) =>
      !value.some((chosen) => chosen.toLowerCase() === skill.toLowerCase()) &&
      (typed.length === 0 || skill.toLowerCase().includes(typed)),
  ).slice(0, MAX_SUGGESTIONS);

  const add = (skill: string) => {
    const result = addRoleSkill(value, skill);
    if ('refused' in result) {
      setProblem(result.refused);
      return;
    }
    setProblem(undefined);
    setEntry('');
    onChange(result.skills);
  };

  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="groupLabel">Skills used in this role</Text>

      {value.length > 0 ? (
        <Animated.View layout={layout} style={[styles.chips, { gap: spacing[2] }]}>
          {value.map((skill) => (
            <Animated.View
              key={skill}
              layout={layout}
              entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
            >
              <SkillChip label={skill} onRemove={() => onChange(removeRoleSkill(value, skill))} />
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}

      <Animated.View layout={layout} style={[styles.addRow, { gap: spacing[3] }]}>
        <TextField
          value={entry}
          onChangeText={(text) => {
            setEntry(text);
            if (problem) setProblem(undefined);
          }}
          placeholder="Add a skill"
          accessibilityLabel="Add a skill"
          error={problem}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmit={() => add(entry)}
          style={styles.field}
        />
        <Button
          label="Add"
          variant="secondary"
          onPress={() => add(entry)}
          disabled={entry.trim().length === 0}
        />
      </Animated.View>

      {suggestions.length > 0 ? (
        <View style={[styles.chips, { gap: spacing[2] }]}>
          {suggestions.map((skill) => (
            <FilterChip
              key={skill}
              variant="select"
              label={skill}
              accessibilityLabel={`${skill}, suggested skill`}
              hint="Adds it to this role"
              onPress={() => add(skill)}
            />
          ))}
        </View>
      ) : null}

      <Text variant="caption" color="textSecondary">
        {value.length === 0 ? 'No skills on this role yet' : pluralize(value.length, 'skill')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  addRow: { flexDirection: 'row', alignItems: 'flex-start' },
  field: { flex: 1 },
});
