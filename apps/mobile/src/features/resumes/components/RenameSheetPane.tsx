import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Resume } from '@/data/models';
import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

/** Long enough for "Senior Product Designer - Stripe (2026)", short enough to stay one line. */
const TITLE_MAX = 80;

/** Pure: the title a draft would save as, or null when there is nothing worth saving. */
export function trimmedTitle(draft: string): string | null {
  const trimmed = draft.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Pure: a draft that saves back what is already stored is a no-op, not an edit. */
export function isUnchangedTitle(draft: string, current: string): boolean {
  return draft.trim() === current.trim();
}

export type RenameSheetPaneProps = {
  resume: Resume;
  /** The rename mutation is in flight; Save owns the spinner. */
  renaming: boolean;
  /** Receives the trimmed title. */
  onSubmit: (title: string) => void;
  onCancel: () => void;
};

/**
 * The rename step of RESUMES 03 (V2 §7.11 — renaming is a title edit, not a screen): a title,
 * one field and two buttons, which is all that fits the short sheet the host raises for it.
 *
 * The menu body renders this under `key={resume.id}`, so opening the menu on a different
 * document remounts the pane and re-seeds the draft. A remount is the honest way to reset local
 * state; an effect keyed on the id would have to race the user's own typing to do the same job.
 */
export function RenameSheetPane({ resume, renaming, onSubmit, onCancel }: RenameSheetPaneProps) {
  const { spacing } = useTheme();
  const [draft, setDraft] = useState(resume.title);
  const [attempted, setAttempted] = useState(false);

  const next = trimmedTitle(draft);
  const blank = next == null;
  const unchanged = !blank && isUnchangedTitle(draft, resume.title);

  const submit = () => {
    if (blank) {
      setAttempted(true);
      return;
    }
    if (unchanged) return;
    onSubmit(next);
  };

  return (
    <View
      style={{ paddingHorizontal: spacing.gutter, paddingVertical: spacing[4], gap: spacing[3] }}
    >
      <Text {...a11yHeader()} variant="headline">
        {resume.docType === 'cover_letter' ? 'Rename this cover letter' : 'Rename this resume'}
      </Text>
      <TextField
        label="Name"
        value={draft}
        onChangeText={(value) => {
          setDraft(value);
          setAttempted(false);
        }}
        error={attempted && blank ? 'Give it a name.' : undefined}
        maxLength={TITLE_MAX}
        autoFocus
        returnKeyType="done"
        onSubmit={submit}
      />
      <View style={[styles.actions, { gap: spacing[3], marginTop: spacing[2] }]}>
        {/*
          Disabled only for a name that is unchanged - a no-op with nothing left to explain.
          A blank name keeps Save pressable on purpose: the press is what says why nothing
          happened, rather than leaving a silently inert button under the finger.
        */}
        <Button label="Save" loading={renaming} disabled={unchanged} onPress={submit} block />
        <Button label="Cancel" variant="ghost" onPress={onCancel} block />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'column' },
});
