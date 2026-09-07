import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Disclosure } from '@/ui/Disclosure';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

/** Responsibilities past this fold away; §7.5 keeps every one of them reachable and editable. */
const VISIBLE = 3;

export type JdResponsibilitiesProps = {
  lines: readonly string[];
  onChange: (lines: string[]) => void;
};

/**
 * The extracted responsibilities, editable (V2 §7.5: "every extracted field is editable before
 * confirmation"). They were bullets before, which made this the one thing on the review screen a
 * misread could not be corrected on — and generation reads them.
 *
 * Each line is its own field so a single misread bullet can be fixed without retyping the list,
 * and the overflow keeps the Disclosure it had, because a JD with a dozen of them would
 * otherwise bury the rest of the form.
 */
export function JdResponsibilities({ lines, onChange }: JdResponsibilitiesProps) {
  const { spacing } = useTheme();
  const [showRest, setShowRest] = useState(false);
  const [entry, setEntry] = useState('');

  const replace = (index: number, line: string) =>
    onChange(lines.map((current, at) => (at === index ? line : current)));

  const remove = (index: number) => onChange(lines.filter((_, at) => at !== index));

  const add = () => {
    const line = entry.trim();
    if (!line) return;
    setEntry('');
    onChange([...lines, line]);
  };

  const rows = (from: number, to: number) => (
    <View style={{ gap: spacing[3] }}>
      {lines.slice(from, to).map((line, offset) => (
        <ResponsibilityRow
          // Addressed by position, not by text: two identical bullets are still two bullets, and
          // the row re-reads its line from props whenever the list around it changes.
          key={from + offset}
          index={from + offset}
          line={line}
          onCommit={replace}
          onRemove={remove}
        />
      ))}
    </View>
  );

  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="section" accessibilityRole="header">
        Responsibilities
      </Text>

      {lines.length === 0 ? (
        <Text variant="body" color="textSecondary">
          None found.
        </Text>
      ) : (
        rows(0, VISIBLE)
      )}

      {lines.length > VISIBLE ? (
        <Disclosure
          expanded={showRest}
          onToggle={() => setShowRest((open) => !open)}
          moreLabel={`Show ${lines.length - VISIBLE} more`}
        >
          {rows(VISIBLE, lines.length)}
        </Disclosure>
      ) : null}

      <View style={[styles.addRow, { gap: spacing[3] }]}>
        <TextField
          value={entry}
          onChangeText={setEntry}
          placeholder="Add a responsibility"
          accessibilityLabel="Add a responsibility"
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

type ResponsibilityRowProps = {
  index: number;
  line: string;
  onCommit: (index: number, line: string) => void;
  onRemove: (index: number) => void;
};

/**
 * One editable line. Committed on blur rather than debounced like the short header fields: a
 * responsibility is a sentence, and a write every 250ms of typing would send a dozen patches per
 * line. `edit` holds the keystrokes until then and is dropped on commit, so the row falls back
 * to whatever the draft says the moment the list around it changes.
 */
function ResponsibilityRow({ index, line, onCommit, onRemove }: ResponsibilityRowProps) {
  const { spacing } = useTheme();
  const [edit, setEdit] = useState<string | null>(null);
  const value = edit ?? line;
  const label = `Responsibility ${index + 1}`;

  const commit = () => {
    setEdit(null);
    const next = value.trim();
    // An emptied line is a removal the user has not asked for, so it is left as it was; the ✕
    // beside it is how a line goes.
    if (next && next !== line) onCommit(index, next);
  };

  return (
    <View style={[styles.row, { gap: spacing[2] }]}>
      <TextField
        value={value}
        onChangeText={setEdit}
        accessibilityLabel={label}
        returnKeyType="done"
        onSubmit={commit}
        onBlur={commit}
        style={styles.field}
      />
      <IconButton
        icon="times"
        label={`Remove ${label.toLowerCase()}`}
        variant="ghost"
        iconColor="iconMuted"
        onPress={() => onRemove(index)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'flex-start' },
  field: { flex: 1 },
});
