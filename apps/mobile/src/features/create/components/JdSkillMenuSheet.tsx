import { View } from 'react-native';

import { a11yButton, a11yHeader, hitSlop8 } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

export type JdSkillCommand<K extends string = string> = {
  key: K;
  label: string;
  /** Paints the destructive row; both are one-shot commands either way. */
  tone?: 'default' | 'danger';
};

export type JdSkillMenuSheetProps<K extends string = string> = {
  open: boolean;
  /** The chip the menu belongs to. Kept by the caller while the sheet slides away. */
  title: string;
  commands: readonly JdSkillCommand<K>[];
  onSelect: (key: K) => void;
  onClose: () => void;
};

/**
 * The menu behind a skill chip on the JD review screen — move it to the other group, or take it
 * out (V2 §7.5).
 *
 * `OptionSheet` was the closer fit visually and the wrong one semantically: its rows are a
 * radiogroup, so with nothing selected VoiceOver announces the destructive "Remove" as "radio
 * button, not selected" — a single-choice control that is never chosen. These rows run a command
 * and close, so they are buttons.
 */
export function JdSkillMenuSheet<K extends string = string>({
  open,
  title,
  commands,
  onSelect,
  onClose,
}: JdSkillMenuSheetProps<K>) {
  const { sizes, spacing } = useTheme();
  const styles = useStyles();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      height={sizes.sheetPickerHeight}
      accessibilityLabel={title || 'Skill options'}
    >
      <View style={{ paddingHorizontal: spacing.gutter, paddingBottom: spacing[4] }}>
        <View style={[styles.header, { paddingVertical: spacing[3] }]}>
          <Text {...a11yHeader(title)} variant="headline" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {/* Named for the menu rather than for the skill: the title blanks on nothing, and a
              label built from it would read "Close " between two skills. */}
          <IconButton icon="times" label="Close skill options" onPress={onClose} />
        </View>

        {commands.map((command) => (
          <Pressable
            key={command.key}
            {...a11yButton(command.label)}
            feedback="subtle"
            haptic="light"
            hitSlop={hitSlop8}
            onPress={() => onSelect(command.key)}
            style={[styles.row, { minHeight: sizes.listRow }]}
          >
            <Text variant="menuRow" color={command.tone === 'danger' ? 'danger' : 'textPrimary'}>
              {command.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const useStyles = scaledSheet(() => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
}));
