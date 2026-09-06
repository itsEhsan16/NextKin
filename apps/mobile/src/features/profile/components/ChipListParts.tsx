import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { a11yButton, hitSlopFor, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { addChip, atCap, capNote, filterSuggestions, removeChip } from '../chipEdits';

/** FilterChip's `removable` metrics, so these chips read as that chip on the page. */
const PADDING_X = 13;
const PADDING_Y = 6;
const GLYPH = 9;
const CHIP_HEIGHT = 32;
/** Loading placeholders: five chips of a plausible spread, a label and the add field. */
const SKELETON_CHIPS = [92, 128, 74, 110, 86];
const SKELETON_LABEL = 18;
const SKELETON_FIELD = 52;

/**
 * One chip on the page. A tap either takes an entry out or puts a suggested one in, so the glyph
 * and the spoken name are the only things that differ between the two rows.
 *
 * Deliberately not `FilterChip variant="removable"`: that variant draws exactly this box, but it
 * names itself "Remove filter <label>" to a screen reader, and a skill is not a filter. The
 * metrics above are copied from it so the two read as the same chip.
 */
function EditorChip({
  label,
  name,
  hint,
  glyph,
  onPress,
}: {
  label: string;
  name: string;
  hint: string;
  glyph: string;
  onPress: () => void;
}) {
  const { colors, radii, spacing, s } = useTheme();

  return (
    <Pressable
      {...a11yButton(name, hint)}
      feedback="subtle"
      haptic="selection"
      hitSlop={hitSlopFor(s(CHIP_HEIGHT))}
      onPress={onPress}
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
      <FontAwesome5 name={glyph} size={s(GLYPH)} color={colors.iconMuted} solid />
    </Pressable>
  );
}

/** The chip list while the profile is still in flight. */
export function ChipListSkeleton() {
  const { spacing, s } = useTheme();
  return (
    <View style={{ gap: spacing[3] }}>
      <Skeleton width="55%" height={s(SKELETON_LABEL)} />
      <View style={[styles.chips, { gap: spacing[2] }]}>
        {SKELETON_CHIPS.map((width) => (
          <Skeleton key={width} width={s(width)} height={s(CHIP_HEIGHT)} radius="full" />
        ))}
      </View>
      <Skeleton height={s(SKELETON_FIELD)} radius="xl" />
    </View>
  );
}

export type ChipListBodyProps = {
  /** Names one entry — "skill", "desired role", "location". */
  noun: string;
  items: readonly string[];
  /** The shipped vocabulary offered under the field (`@/data/models`). */
  suggestions: readonly string[];
  placeholder: string;
  /** The add field's accessible label — "Add a skill". */
  addLabel: string;
  max?: number;
  countLine: (count: number) => string;
  /** Why the list is worth filling. Shown in place of the chips while there are none. */
  emptyMessage: string;
  onChange: (next: string[]) => void;
};

/**
 * The editable list itself (V2 §7.3): chips you can take out, one field to add with, the shipped
 * vocabulary offered underneath, and a count.
 *
 * An empty list is not an error state — the add field IS the empty state, with the line that
 * explains why the list matters above it. A StateView over an editable list would hide the one
 * control the reader came here for.
 */
export function ChipListBody({
  noun,
  items,
  suggestions,
  placeholder,
  addLabel,
  max,
  countLine,
  emptyMessage,
  onChange,
}: ChipListBodyProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const [entry, setEntry] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);

  // Dropped rather than shortened under reduced motion: a chip sliding into place is the movement
  // the setting asks us not to make.
  const layout = reduced ? undefined : LinearTransition.springify();
  const full = atCap(items, max);
  const offered = filterSuggestions(suggestions, items, entry);

  const add = (value: string) => {
    const result = addChip(items, value, noun, max);
    if ('refused' in result) {
      setProblem(result.refused);
      return;
    }
    setProblem(undefined);
    setEntry('');
    onChange(result.items);
  };

  return (
    <View style={{ gap: spacing[3] }}>
      {items.length === 0 ? (
        <Text variant="body" color="textSecondary">
          {emptyMessage}
        </Text>
      ) : (
        <Animated.View layout={layout} style={[styles.chips, { gap: spacing[2] }]}>
          {items.map((item) => (
            <Animated.View
              key={item}
              layout={layout}
              entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
              exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
            >
              <EditorChip
                label={item}
                name={`${item}, ${noun}`}
                hint={`Removes ${item}`}
                glyph="times"
                onPress={() => onChange(removeChip(items, item))}
              />
            </Animated.View>
          ))}
        </Animated.View>
      )}

      <Animated.View layout={layout} style={[styles.addRow, { gap: spacing[3] }]}>
        <TextField
          value={entry}
          onChangeText={(text) => {
            setEntry(text);
            if (problem) setProblem(undefined);
          }}
          placeholder={placeholder}
          accessibilityLabel={addLabel}
          error={problem}
          // §13.5: the cap stands on screen rather than appearing only once it refuses something.
          helper={full && max != null ? capNote(max) : undefined}
          editable={!full}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmit={() => add(entry)}
          style={styles.field}
        />
        <Button
          label="Add"
          variant="secondary"
          onPress={() => add(entry)}
          disabled={full || entry.trim().length === 0}
        />
      </Animated.View>

      {offered.length > 0 && !full ? (
        <Animated.View layout={layout} style={[styles.chips, { gap: spacing[2] }]}>
          {offered.map((item) => (
            <EditorChip
              key={item}
              label={item}
              name={`${item}, suggested ${noun}`}
              hint={`Adds ${item}`}
              glyph="plus"
              onPress={() => add(item)}
            />
          ))}
        </Animated.View>
      ) : null}

      <Text variant="caption" color="textSecondary">
        {countLine(items.length)}
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
