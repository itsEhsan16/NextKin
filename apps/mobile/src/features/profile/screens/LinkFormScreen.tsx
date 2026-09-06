import { useState } from 'react';

import { LINK_KIND_LABEL, type LinkKind } from '@/data/models';
import { useProfile, useRemoveLink, useUpsertLink } from '@/data/queries';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';

import { LinkFields } from '../components/forms/LinkFields';
import { formError, ProfileFormShell } from '../components/forms/ProfileFormShell';
import { useEntryForm } from '../components/forms/useEntryForm';
import { useProfileActions } from '../hooks/useProfileActions';
import { blankLink, linkDraft, linkEntry, validateLink } from '../profileForms';

export type LinkFormScreenProps = { id: string };

const DELETE_MESSAGE = 'This link comes off your profile. The page it points at is untouched.';

/** Built from the shipped vocabulary rather than a list of our own (V2 §7.3). */
const KIND_OPTIONS: readonly SheetOption<LinkKind>[] = (
  Object.keys(LINK_KIND_LABEL) as LinkKind[]
).map((kind) => ({ key: kind, label: LINK_KIND_LABEL[kind] }));

/**
 * Add or edit one profile link (V2 §7.3). The role form's page, with a kind picker, a name and
 * an address that is normalised to https on the way out — see `normaliseUrl`.
 */
export function LinkFormScreen({ id }: LinkFormScreenProps) {
  const actions = useProfileActions();
  const profile = useProfile();
  const save = useUpsertLink();
  const remove = useRemoveLink();

  const entry = profile.data?.links.find((item) => item.id === id);
  const form = useEntryForm({
    id,
    entry,
    loading: profile.isPending,
    failed: profile.isError,
    blank: blankLink,
    toDraft: linkDraft,
    validate: validateLink,
  });

  const [kindOpen, setKindOpen] = useState(false);
  const draft = form.draft;

  const onSave = () => {
    const ready = form.submit();
    if (!ready) return;
    // A new link goes out with an empty id — the repo mints the real one (see profileForms).
    save.mutate(linkEntry(form.isNew ? '' : id, ready), { onSuccess: actions.goBack });
  };

  return (
    <ProfileFormShell
      title={form.isNew ? 'Add link' : 'Edit link'}
      status={form.status}
      listLabel="links"
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
              label: 'Delete link',
              message: DELETE_MESSAGE,
              busy: remove.isPending,
              onConfirm: () => remove.mutate(id, { onSuccess: actions.goBack }),
            }
      }
      sheets={
        draft ? (
          <OptionSheet
            open={kindOpen}
            title="What kind of link?"
            options={KIND_OPTIONS}
            selectedKey={draft.kind}
            onSelect={(kind) => {
              setKindOpen(false);
              form.patch({ kind });
            }}
            onClose={() => setKindOpen(false)}
          />
        ) : null
      }
    >
      {draft ? (
        <LinkFields
          draft={draft}
          patch={form.patch}
          errors={form.errors}
          blur={form.blur}
          onPickKind={() => setKindOpen(true)}
        />
      ) : null}
    </ProfileFormShell>
  );
}
