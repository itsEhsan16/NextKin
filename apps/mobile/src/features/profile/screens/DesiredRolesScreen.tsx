import { useState } from 'react';

import { MAX_DESIRED_ROLES, ROLE_SUGGESTIONS } from '@/data/models';
import { useProfile, useUpdatePreferences } from '@/data/queries';

import { listsEqual } from '../chipEdits';
import { ChipListEditor } from '../components/ChipListEditor';
import { useProfileActions } from '../hooks/useProfileActions';
import { PROFILE_ROW_ART } from '../profileRowArt';

const NOTE = 'Matching and tailoring aim at the titles you add here.';

/**
 * The desired-role list on the career profile (V2 §7.3, PROFILE 15 580:1175), capped at
 * `MAX_DESIRED_ROLES` — the same cap the Profile tab's row already counts against, so "3 of 5"
 * reads the same in both places, here over a meter.
 *
 * §13.5: the cap stands on the page before it refuses anything. At five the field goes inert with
 * the limit as its helper rather than letting a sixth be typed and then knocked back.
 */
export function DesiredRolesScreen() {
  const actions = useProfileActions();
  const profile = useProfile();
  const save = useUpdatePreferences();
  const [draft, setDraft] = useState<string[] | null>(null);

  // Compared against the profile as it stands now — see the note on SkillsScreen.
  const saved = profile.data?.preferences.desiredRoles;
  const items = draft ?? saved ?? [];
  const dirty = draft != null && saved != null && !listsEqual(draft, saved);

  return (
    <ChipListEditor
      title="Desired roles"
      summary={{
        art: PROFILE_ROW_ART.desiredRoles,
        title: `${items.length} of ${MAX_DESIRED_ROLES} roles added`,
        progress: items.length / MAX_DESIRED_ROLES,
      }}
      listTitle="Your desired roles"
      noun="desired role"
      items={items}
      suggestions={ROLE_SUGGESTIONS}
      suggestionsIn="card"
      placeholder="Type a job title"
      addLabel="Add a desired role"
      max={MAX_DESIRED_ROLES}
      note={NOTE}
      onChange={setDraft}
      loading={profile.isPending}
      error={profile.isError}
      onRetry={() => void profile.refetch()}
      dirty={dirty}
      saving={save.isPending}
      failed={save.isError}
      onSave={() => {
        if (draft) {
          save.mutate(
            { desiredRoles: draft },
            { onSuccess: () => actions.backWith('Desired roles saved') },
          );
        }
      }}
      onClose={actions.goBack}
    />
  );
}
