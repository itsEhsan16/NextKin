import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useCreateResume } from '@/data/queries';
// Deep, not through '@/features/create': the create barrel pulls in every create screen, and
// TailorScreen already reaches into '@/features/resumes/docMeta' the same way for the same reason.
import { CREATE_RESUME_FOOTNOTE } from '@/features/create/createSteps';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { trimmedTitle } from '../components/RenameSheetPane';
import { useResumesActions } from '../hooks/useResumesActions';

/** The same ceiling the rename pane uses — long enough to date a role, short enough to stay a line. */
const TITLE_MAX = 80;
const NAME_REQUIRED = 'Give it a name.';
/** V2 §7.6 forbids a silent failure; the reason goes on the bar that started the work. */
const CREATE_FAILED = "We couldn't create it. Check your connection and try again.";

/**
 * "Start from scratch" (V2 §7.11, CREATE 02 row 4): name the document, then edit it.
 *
 * No artboard draws this (plan §8), so it is the built form skeleton with one field in it.
 *
 * There is no loading, empty or error *state* to draw: the page reads nothing, so it has nothing
 * to wait for and nothing to be empty of. The only failure it can have is the create itself, and
 * that lands on the action bar's note with the button still live.
 */
export function NewResumeScreen() {
  const { spacing } = useTheme();
  // Not `useResumesActions().openEditor`, which pushes: the document exists by the time we
  // navigate, so the form must not stay on the back stack for a second, duplicate create.
  const router = useRouter();
  const { goBack } = useResumesActions();
  const createResume = useCreateResume();

  const [draft, setDraft] = useState('');
  /** Create has been pressed on a blank name; until then an error would be a telling-off. */
  const [refused, setRefused] = useState(false);

  const title = trimmedTitle(draft);

  const submit = () => {
    if (title == null) {
      setRefused(true);
      return;
    }
    if (createResume.isPending) return;
    createResume.mutate(
      { title, docType: 'resume' },
      {
        onSuccess: (resume) =>
          router.replace({ pathname: '/resumes/[id]', params: { id: resume.id } }),
      },
    );
  };

  return (
    <Screen
      keyboard
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="New resume" onBack={goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
      footer={
        <StickyActionBar
          note={createResume.isError ? CREATE_FAILED : undefined}
          primary={{
            label: 'Create',
            loading: createResume.isPending,
            // Deliberately never `disabled`. A blank name keeps Create pressable so the press is
            // what says why nothing happened, rather than leaving an inert button under the
            // finger — the rename pane refuses out loud in exactly the same way.
            onPress: submit,
          }}
        />
      }
    >
      <TextField
        label="Resume name"
        value={draft}
        onChangeText={(value) => {
          setDraft(value);
          setRefused(false);
        }}
        placeholder="Product Designer — 2026"
        error={refused && title == null ? NAME_REQUIRED : undefined}
        helper="You can rename it any time."
        maxLength={TITLE_MAX}
        autoFocus
        returnKeyType="done"
        onSubmit={submit}
      />
      <Text variant="caption" color="textSecondary">
        {CREATE_RESUME_FOOTNOTE}
      </Text>
    </Screen>
  );
}
