import { useState } from 'react';

import { useProfile, useRemoveExperience, useUpsertExperience } from '@/data/queries';
import { MonthYearSheet } from '@/ui/MonthYearSheet';

import { ExperienceFields, type ExperienceDateField } from '../components/forms/ExperienceFields';
import { formError, ProfileFormShell } from '../components/forms/ProfileFormShell';
import { useEntryForm } from '../components/forms/useEntryForm';
import { useProfileActions } from '../hooks/useProfileActions';
import {
  blankExperience,
  experienceDraft,
  experienceEntry,
  validateExperience,
} from '../profileForms';

export type ExperienceFormScreenProps = { id: string };

const DELETE_MESSAGE =
  'This role and the skills on it come off your profile. Documents you have already generated keep the text they were built with.';

/**
 * Add or edit one role (V2 §7.3). No artboard draws it (plan §8), so it is assembled from the
 * built primitives alone: `ProfileFormShell` is the page and its four states, and this file is
 * the fields, the date picker and the two writes.
 */
export function ExperienceFormScreen({ id }: ExperienceFormScreenProps) {
  const actions = useProfileActions();
  const profile = useProfile();
  const save = useUpsertExperience();
  const remove = useRemoveExperience();

  const entry = profile.data?.experiences.find((item) => item.id === id);
  const form = useEntryForm({
    id,
    entry,
    loading: profile.isPending,
    failed: profile.isError,
    blank: blankExperience,
    toDraft: experienceDraft,
    validate: validateExperience,
  });

  // The field the picker is aimed at outlives the close, so the sheet keeps its exit animation
  // rather than being torn out by a changing key mid-flight.
  const [picking, setPicking] = useState<ExperienceDateField>('startDate');
  const [pickerOpen, setPickerOpen] = useState(false);
  const draft = form.draft;

  const onSave = () => {
    const ready = form.submit();
    if (!ready) return;
    // A new role goes out with an empty id — the repo mints the real one (see profileForms).
    save.mutate(experienceEntry(form.isNew ? '' : id, ready), { onSuccess: actions.goBack });
  };

  return (
    <ProfileFormShell
      title={form.isNew ? 'Add role' : 'Edit role'}
      status={form.status}
      listLabel="work experience"
      dirty={form.dirty}
      valid={form.valid}
      saving={save.isPending}
      note={formError(save.isError, remove.isError, form.errors)}
      onSave={onSave}
      onLeave={actions.goBack}
      onRetry={() => void profile.refetch()}
      remove={
        form.isNew
          ? undefined
          : {
              label: 'Delete role',
              message: DELETE_MESSAGE,
              busy: remove.isPending,
              onConfirm: () => remove.mutate(id, { onSuccess: actions.goBack }),
            }
      }
      sheets={
        draft ? (
          <MonthYearSheet
            key={picking}
            open={pickerOpen}
            title={picking === 'endDate' ? 'When did you leave?' : 'When did you start?'}
            value={draft[picking] || undefined}
            onSelect={(picked) => {
              setPickerOpen(false);
              // `allowPresent` is off — the switch on the form owns "still here" — so the sheet
              // only ever resolves to an ISO month here.
              if (picked === 'present') return;
              form.patch(picking === 'startDate' ? { startDate: picked } : { endDate: picked });
            }}
            onClose={() => setPickerOpen(false)}
          />
        ) : null
      }
    >
      {draft ? (
        <ExperienceFields
          draft={draft}
          patch={form.patch}
          errors={form.errors}
          blur={form.blur}
          onPickDate={(field) => {
            setPicking(field);
            setPickerOpen(true);
          }}
        />
      ) : null}
    </ProfileFormShell>
  );
}
