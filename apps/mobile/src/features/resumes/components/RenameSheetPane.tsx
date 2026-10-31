import { useState } from 'react';
import { View } from 'react-native';

import RenameIcon from '../../../../assets/icons/doc-menu/rename.svg';
import type { Resume } from '@/data/models';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

/** Long enough for "Senior Product Designer - Stripe (2026)", short enough to stay one line. */
const TITLE_MAX = 80;

// RESUMES 12's sheet at 390 (580:2393), in artboard units.
const TOP = 16 / 0.75; // handle → header: the board's 30 less the handle and its margin
const BOTTOM = 30 / 0.75;
const HEADER_GAP = 12 / 0.75;
const ICON_W = 42 / 0.75;
const ICON_H = 41.0954 / 0.75;
const HEADER_TO_FIELD = 18 / 0.75;
const FIELD_TO_SAVE = 20 / 0.75;
const BUTTON_GAP = 10 / 0.75;

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
 * The rename step of the card menu (V2 §7.11 — renaming is a title edit, not a screen), drawn as
 * RESUMES 12 (580:2393): the rename drawing and a title, one field, then Save over Cancel.
 *
 * The menu body renders this under `key={resume.id}`, so opening the menu on a different
 * document remounts the pane and re-seeds the draft. A remount is the honest way to reset local
 * state; an effect keyed on the id would have to race the user's own typing to do the same job.
 */
export function RenameSheetPane({ resume, renaming, onSubmit, onCancel }: RenameSheetPaneProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
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
    <View style={[styles.body, { paddingHorizontal: spacing.gutter }]}>
      <View style={styles.header}>
        <RenameIcon width={s(ICON_W)} height={s(ICON_H)} />
        <Text {...a11yHeader()} variant="confirmTitle" style={styles.title}>
          {resume.docType === 'cover_letter' ? 'Rename this cover letter' : 'Rename this resume'}
        </Text>
      </View>
      <TextField
        label="Name"
        icon="File06"
        style={styles.field}
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
      <View style={styles.actions}>
        {/*
          Disabled only for a name that is unchanged - a no-op with nothing left to explain.
          A blank name keeps Save pressable on purpose: the press is what says why nothing
          happened, rather than leaving a silently inert button under the finger.
        */}
        <Button
          label="Save"
          size="lg"
          loading={renaming}
          disabled={unchanged}
          onPress={submit}
          block
        />
        <Button label="Cancel" variant="ghost" size="lg" onPress={onCancel} block />
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  body: { paddingTop: s(TOP), paddingBottom: s(BOTTOM) },
  header: { flexDirection: 'row', alignItems: 'center', gap: s(HEADER_GAP) },
  title: { flex: 1 },
  field: { marginTop: s(HEADER_TO_FIELD) },
  actions: { marginTop: s(FIELD_TO_SAVE), gap: s(BUTTON_GAP) },
}));
