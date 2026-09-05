import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { a11yButton, hitSlopFor, pluralize, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { addEntry, removeEntry } from '../../sectionEdits';
import type { SectionFieldsProps } from './types';

/** FilterChip's `removable` metrics, so this chip is that chip — see the note on the component. */
const PADDING_X = 13;
const PADDING_Y = 6;
const TIMES = 9;
const CHIP_HEIGHT = 32;

/**
 * One entry of an editable string list.
 *
 * Deliberately not `FilterChip variant="removable"`: that variant draws exactly this box, but it
 * names itself "Remove filter <label>" to a screen reader, and a skill is not a filter. The
 * metrics above are copied from it so the two read as the same chip on the page.
 */
function EntryChip({
  label,
  noun,
  onRemove,
}: {
  label: string;
  noun: string;
  onRemove: () => void;
}) {
  const { colors, radii, spacing, s } = useTheme();

  return (
    <Pressable
      {...a11yButton(`${label}, ${noun}`, `Removes ${label}`)}
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

export type StringListEditorProps = SectionFieldsProps<string[]> & {
  /** "skill" / "certification" — names the noun in every label and message on the section. */
  noun: string;
  label: string;
};

/**
 * V2 §7.11 — the shape both plain-string sections take: chips you can take out, one field to add
 * with, and a count. An empty list is not an error state: the add row IS the empty state.
 */
export function StringListEditor({
  value,
  onChange,
  noun,
  label,
  onBlurField,
}: StringListEditorProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const [entry, setEntry] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);

  // Dropped rather than shortened under reduced motion: a chip sliding into place is the movement
  // the setting asks us not to make.
  const layout = reduced ? undefined : LinearTransition.springify();

  const add = () => {
    const result = addEntry(value, entry, noun);
    if ('refused' in result) {
      setProblem(result.refused);
      return;
    }
    setProblem(undefined);
    setEntry('');
    onChange(result.entries);
  };

  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="groupLabel">{label}</Text>

      {value.length > 0 ? (
        <Animated.View layout={layout} style={[styles.chips, { gap: spacing[2] }]}>
          {value.map((item) => (
            <Animated.View
              key={item}
              layout={layout}
              entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
            >
              <EntryChip
                label={item}
                noun={noun}
                onRemove={() => onChange(removeEntry(value, item))}
              />
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
          onBlur={() => onBlurField?.(noun)}
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
      </Animated.View>

      <Text variant="caption" color="textSecondary">
        {value.length === 0 ? `No ${noun}s yet` : pluralize(value.length, noun)}
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
