import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { a11yButton, hitSlopFor, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { itemExit, layoutTransition } from '@/ui/motion';
import { Icon } from '@/ui/Icon';

// The editor chips and add row at 390 (PROFILE 05 573:254 / 573:272, 573:263), in artboard units.
const CHIP_PAD_LEFT = 12 / 0.75;
const CHIP_PAD_RIGHT = 11 / 0.75;
const CHIP_PAD_Y = 7 / 0.75;
const CHIP_GAP = 6 / 0.75;
const CHIP_HEIGHT = 31 / 0.75;
const ROW_GAP = 8 / 0.75;
const COLUMN_GAP = 7 / 0.75;
const ADD_GAP = 9 / 0.75;
const ADD_WIDTH = 76 / 0.75;
/** Loading placeholders: five chips of a plausible spread. */

/**
 * One chip in a profile editor. A chosen entry is brand-tinted with a ✕ (573:254); a suggestion is
 * white with a brand + (573:272). A tap takes the one out or puts the other in, so the look, the
 * glyph and the spoken name are the only things that differ.
 *
 * Deliberately not `FilterChip`: its removable variant names itself "Remove filter <label>" to a
 * screen reader, and a skill is not a filter.
 */
export function EditorChip({
  label,
  name,
  hint,
  chosen,
  onPress,
}: {
  label: string;
  name: string;
  hint: string;
  chosen: boolean;
  onPress: () => void;
}) {
  const { colors, radii, sizes, s } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      {...a11yButton(name, hint)}
      feedback="subtle"
      hitSlop={hitSlopFor(s(CHIP_HEIGHT))}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: radii.full,
          borderWidth: sizes.border,
          backgroundColor: chosen ? colors.brandSurface : colors.surfaceCard,
          borderColor: chosen ? colors.brandBorder : colors.borderDefault,
        },
      ]}
    >
      {chosen ? null : <Icon name="Plus" size="sm" color={colors.brand} />}
      <Text variant="caption" color={chosen ? 'textPrimary' : 'textBody'} numberOfLines={1}>
        {label}
      </Text>
      {chosen ? <Icon name="XClose" size="sm" color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

/** A wrapping row of chips at the boards' 8 × 7 spacing. */
export function ChipWrap({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  return (
    <Animated.View layout={layoutTransition(reduced)} style={styles.wrap}>
      {children}
    </Animated.View>
  );
}

/** The chip editor while the profile is still in flight. */
export function ChipListSkeleton() {
  const { sizes, spacing, s } = useTheme();
  return (
    <View style={{ gap: spacing[4] }}>
      {/* One strip for the chips (§191): two rows of them, as five usually wrap. */}
      <Skeleton height={s(CHIP_HEIGHT) * 2 + s(ROW_GAP)} radius="lg" />
      {/* The add field's real height, so nothing jumps on load. */}
      <Skeleton height={sizes.searchField} radius="xl" />
    </View>
  );
}

export type ChipFieldProps = {
  /** Names one entry — "skill", "desired role", "location". */
  noun: string;
  items: readonly string[];
  placeholder: string;
  /** The add field's accessible label — "Add a skill". */
  addLabel: string;
  /** Adds one; returns why it was refused, or nothing when it went in. */
  onAdd: (value: string) => string | undefined;
  onRemove: (item: string) => void;
  /** At the cap: the field goes inert with this as its helper (§13.5). */
  fullNote?: string;
  /** Said in place of the chips while there are none. */
  emptyMessage?: string;
};

/**
 * The chosen chips and the field to add one more (PROFILE 09 577:8003 / 577:8040). An empty list
 * is not an error state — the add row IS the empty state, under a line on why the list matters.
 */
export function ChipField({
  noun,
  items,
  placeholder,
  addLabel,
  onAdd,
  onRemove,
  fullNote,
  emptyMessage,
}: ChipFieldProps) {
  const { motion, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const [entry, setEntry] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const full = fullNote != null;

  const add = (value: string) => {
    const refused = onAdd(value);
    if (refused) {
      setProblem(refused);
      return;
    }
    setProblem(undefined);
    setEntry('');
  };

  return (
    <>
      {items.length === 0 ? (
        emptyMessage ? (
          <Text variant="body" color="textSecondary">
            {emptyMessage}
          </Text>
        ) : null
      ) : (
        <ChipWrap>
          {items.map((item) => (
            <Animated.View
              key={item}
              entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
              exiting={itemExit(reduced)}
            >
              <EditorChip
                label={item}
                name={`${item}, ${noun}`}
                hint={`Removes ${item}`}
                chosen
                onPress={() => onRemove(item)}
              />
            </Animated.View>
          ))}
        </ChipWrap>
      )}

      <View style={styles.addRow}>
        <TextField
          value={entry}
          onChangeText={(text) => {
            setEntry(text);
            if (problem) setProblem(undefined);
          }}
          icon="Plus"
          placeholder={placeholder}
          accessibilityLabel={addLabel}
          error={problem}
          // §13.5: the cap stands on screen rather than appearing only once it refuses something.
          helper={fullNote}
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
          style={{ width: s(ADD_WIDTH), paddingHorizontal: 0 }}
        />
      </View>
    </>
  );
}

/** Suggested entries, each one tap from the list (577:8051). */
export function SuggestionChips({
  noun,
  items,
  onAdd,
}: {
  noun: string;
  items: readonly string[];
  onAdd: (item: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ChipWrap>
      {items.map((item) => (
        <EditorChip
          key={item}
          label={item}
          name={`${item}, suggested ${noun}`}
          hint={`Adds ${item}`}
          chosen={false}
          onPress={() => onAdd(item)}
        />
      ))}
    </ChipWrap>
  );
}

/** "Suggested", when the suggestions share a card with the list (573:270). */
export function SuggestedLabel() {
  return (
    <Text variant="microBadge" color="textSecondary">
      Suggested
    </Text>
  );
}

const useStyles = scaledSheet((s) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: s(CHIP_GAP),
    paddingLeft: s(CHIP_PAD_LEFT),
    paddingRight: s(CHIP_PAD_RIGHT),
    paddingVertical: s(CHIP_PAD_Y),
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', rowGap: s(ROW_GAP), columnGap: s(COLUMN_GAP) },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: s(ADD_GAP) },
  field: { flex: 1 },
}));
