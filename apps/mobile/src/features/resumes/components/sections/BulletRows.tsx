import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { a11yButton, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { itemExit, layoutTransition } from '@/ui/motion';

import { removeAt, replaceAt } from '../../sectionEdits';
import { Icon } from '@/ui/Icon';

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

// "What you did" at 390 (RESUMES 07 577:8659), in artboard units.
const LIST_GAP = 8 / 0.75;
const REMOVE = 22 / 0.75;
const ADD_HEIGHT = 46 / 0.75;
const ADD_RADIUS = 13.5 / 0.75;
const ADD_BORDER = 1 / 0.75;
const ADD_GAP = 10 / 0.75;
const ADD_DISC = 24 / 0.75;
/** Add bullet sits 14 under the last bullet (577:8673). */
const ADD_TOP = 14 / 0.75;

/** Keys for bullet rows, unique for the app's lifetime — never an index (see `BulletRows`). */
let lastBulletId = 0;
const newBulletId = () => {
  lastBulletId += 1;
  return `bullet-${lastBulletId}`;
};

/** The dashed lavender "+ Add bullet" row under a bullet list (577:8673). */
function AddBullet({ entryName, onPress }: { entryName: string; onPress: () => void }) {
  const { colors, radii } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton('Add bullet', `Adds a bullet to ${entryName}`)}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.add,
        { borderColor: colors.borderDashed, backgroundColor: colors.surfaceNewDoc },
      ]}
    >
      <View
        style={[styles.disc, { borderRadius: radii.full, backgroundColor: colors.surfaceInverse }]}
      >
        <Icon name="Plus" size="md" color={colors.textOnDark} />
      </View>
      <Text variant="bodySemiBold">Add bullet</Text>
    </Pressable>
  );
}

/**
 * The bullet list under a role or a project (V2 §7.11), drawn as RESUMES 07: each bullet a grey
 * textarea with its own small ✕ inside, then the dashed Add bullet row. Every mutation goes
 * through the pure helpers in `sectionEdits`, so the array surgery is unit-tested rather than
 * inlined here.
 */
export function BulletRows({
  entryId,
  entryName,
  bullets,
  onChange,
  errors,
  onBlurField,
}: BulletRowsProps) {
  const { colors, motion, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const layout = layoutTransition(reduced);

  // A stable key per bullet. Keyed by index, removing a middle bullet re-keyed every row after it:
  // React kept the removed row's view and moved the text up into it, and the LAST row was the one
  // that vanished. The ids follow this list's own edits; a change from outside (a discard) that
  // alters the length re-keys the lot.
  const [ids, setIds] = useState(() => bullets.map(newBulletId));
  if (ids.length !== bullets.length) setIds(bullets.map(newBulletId));

  return (
    <View style={styles.list}>
      <Text variant="groupLabel">What you did</Text>

      {bullets.map((bullet, index) => {
        const key = `${entryId}.bullet.${index}`;
        return (
          <Animated.View
            key={ids[index] ?? key}
            layout={layout}
            entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
            exiting={itemExit(reduced)}
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
              trailing={
                <IconButton
                  icon="XClose"
                  label={`Remove bullet ${index + 1} of ${entryName}`}
                  size={s(REMOVE)}
                  iconSize="sm"
                  iconColor="textSecondary"
                  variant="ghost"
                  onPress={() => {
                    setIds(removeAt(ids, index));
                    onChange(removeAt(bullets, index));
                  }}
                  style={{ backgroundColor: colors.surfaceCard }}
                />
              }
            />
          </Animated.View>
        );
      })}

      <Animated.View layout={layout} style={styles.addSlot}>
        <AddBullet
          entryName={entryName}
          onPress={() => {
            setIds([...ids, newBulletId()]);
            onChange([...bullets, '']);
          }}
        />
      </Animated.View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  list: { gap: s(LIST_GAP) },
  addSlot: { marginTop: s(ADD_TOP - LIST_GAP) },
  add: {
    height: s(ADD_HEIGHT),
    borderRadius: s(ADD_RADIUS),
    borderWidth: s(ADD_BORDER),
    borderStyle: 'dashed',
    gap: s(ADD_GAP),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    width: s(ADD_DISC),
    height: s(ADD_DISC),
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
