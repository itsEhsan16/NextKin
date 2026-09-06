import { useState } from 'react';

import { useProfile, useRemoveCertification, useUpsertCertification } from '@/data/queries';
import { MonthYearSheet } from '@/ui/MonthYearSheet';

import {
  CertificationFields,
  type CertificationDateField,
} from '../components/forms/CertificationFields';
import { formError, ProfileFormShell } from '../components/forms/ProfileFormShell';
import { useEntryForm } from '../components/forms/useEntryForm';
import { useProfileActions } from '../hooks/useProfileActions';
import {
  blankCertification,
  certificationDraft,
  certificationEntry,
  validateCertification,
} from '../profileForms';

export type CertificationFormScreenProps = { id: string };

/**
 * The picker offers this year at the top by default, which is right for an issue date and wrong
 * for an expiry — a credential that expires does so in the future.
 */
const EXPIRY_YEARS_AHEAD = 20;

const DELETE_MESSAGE =
  'This credential comes off your profile. Documents you have already generated keep the text they were built with.';

/** Add or edit one credential (V2 §7.3). The role form's page, with the certification fields. */
export function CertificationFormScreen({ id }: CertificationFormScreenProps) {
  const actions = useProfileActions();
  const profile = useProfile();
  const save = useUpsertCertification();
  const remove = useRemoveCertification();

  const entry = profile.data?.certifications.find((item) => item.id === id);
  const form = useEntryForm({
    id,
    entry,
    loading: profile.isPending,
    failed: profile.isError,
    blank: blankCertification,
    toDraft: certificationDraft,
    validate: validateCertification,
  });

  const [picking, setPicking] = useState<CertificationDateField>('issuedOn');
  const [pickerOpen, setPickerOpen] = useState(false);
  const draft = form.draft;

  const onSave = () => {
    const ready = form.submit();
    if (!ready) return;
    // A new entry goes out with an empty id — the repo mints the real one (see profileForms).
    save.mutate(certificationEntry(form.isNew ? '' : id, ready), { onSuccess: actions.goBack });
  };

  return (
    <ProfileFormShell
      title={form.isNew ? 'Add certification' : 'Edit certification'}
      status={form.status}
      listLabel="certifications"
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
              label: 'Delete certification',
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
            title={picking === 'expiresOn' ? 'When does it expire?' : 'When was it issued?'}
            value={draft[picking] || undefined}
            maxYear={
              picking === 'expiresOn' ? new Date().getFullYear() + EXPIRY_YEARS_AHEAD : undefined
            }
            onSelect={(picked) => {
              setPickerOpen(false);
              // `allowPresent` is off: a credential is issued in a month or it is not.
              if (picked === 'present') return;
              form.patch(picking === 'issuedOn' ? { issuedOn: picked } : { expiresOn: picked });
            }}
            onClose={() => setPickerOpen(false)}
          />
        ) : null
      }
    >
      {draft ? (
        <CertificationFields
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
