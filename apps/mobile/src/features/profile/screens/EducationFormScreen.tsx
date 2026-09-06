import { useState } from 'react';

import { useProfile, useRemoveEducation, useUpsertEducation } from '@/data/queries';
import { MonthYearSheet } from '@/ui/MonthYearSheet';

import { EducationFields, type EducationDateField } from '../components/forms/EducationFields';
import { formError, ProfileFormShell } from '../components/forms/ProfileFormShell';
import { useEntryForm } from '../components/forms/useEntryForm';
import { useProfileActions } from '../hooks/useProfileActions';
import { blankEducation, educationDraft, educationEntry, validateEducation } from '../profileForms';

export type EducationFormScreenProps = { id: string };

const DELETE_MESSAGE =
  'This qualification comes off your profile. Documents you have already generated keep the text they were built with.';

/** Add or edit one qualification (V2 §7.3). The role form's page, with the education fields. */
export function EducationFormScreen({ id }: EducationFormScreenProps) {
  const actions = useProfileActions();
  const profile = useProfile();
  const save = useUpsertEducation();
  const remove = useRemoveEducation();

  const entry = profile.data?.education.find((item) => item.id === id);
  const form = useEntryForm({
    id,
    entry,
    loading: profile.isPending,
    failed: profile.isError,
    blank: blankEducation,
    toDraft: educationDraft,
    validate: validateEducation,
  });

  const [picking, setPicking] = useState<EducationDateField>('startDate');
  const [pickerOpen, setPickerOpen] = useState(false);
  const draft = form.draft;

  const onSave = () => {
    const ready = form.submit();
    if (!ready) return;
    // A new entry goes out with an empty id — the repo mints the real one (see profileForms).
    save.mutate(educationEntry(form.isNew ? '' : id, ready), { onSuccess: actions.goBack });
  };

  return (
    <ProfileFormShell
      title={form.isNew ? 'Add education' : 'Edit education'}
      status={form.status}
      listLabel="education"
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
              label: 'Delete education',
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
            title={picking === 'endDate' ? 'When did you finish?' : 'When did you start?'}
            value={draft[picking] || undefined}
            onSelect={(picked) => {
              setPickerOpen(false);
              // `allowPresent` is off — the switch on the form owns "still studying".
              if (picked === 'present') return;
              form.patch(picking === 'startDate' ? { startDate: picked } : { endDate: picked });
            }}
            onClose={() => setPickerOpen(false)}
          />
        ) : null
      }
    >
      {draft ? (
        <EducationFields
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
