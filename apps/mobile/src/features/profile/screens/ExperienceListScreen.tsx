import type { Profile } from '@/data/models';

import { EntryListScreen, type EntryListRow } from '../components/EntryListScreen';
import { experienceRow } from '../entryRows';
import { useProfileActions } from '../hooks/useProfileActions';

const ADD = 'Add a role';

const selectRows = (profile: Profile): EntryListRow[] => profile.experiences.map(experienceRow);

/**
 * Work experience (V2 §7.3) — the roles every generated document is written from. No artboard
 * (plan §8); the page is `EntryListScreen`, configured.
 */
export function ExperienceListScreen() {
  const actions = useProfileActions();

  return (
    <EntryListScreen
      title="Work experience"
      select={selectRows}
      addLabel={ADD}
      onOpen={actions.openExperienceEntry}
      empty={{
        icon: 'briefcase',
        title: 'No roles yet',
        message: 'Your work history is what everything else is generated from.',
      }}
    />
  );
}
