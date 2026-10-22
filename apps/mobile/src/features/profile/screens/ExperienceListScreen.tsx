import type { Profile } from '@/data/models';
import { pluralize } from '@/lib';

import { EntryListScreen, type EntryListRow } from '../components/EntryListScreen';
import { experienceRow, newestFirst } from '../entryRows';
import { useProfileActions } from '../hooks/useProfileActions';
import { PROFILE_ROW_ART } from '../profileRowArt';

const LEDE = 'Your work history is what everything else is generated from.';

const selectRows = (profile: Profile): EntryListRow[] =>
  newestFirst(profile.experiences).map(experienceRow);

/**
 * Work experience (V2 §7.3, PROFILE 04 573:2) — the roles every generated document is written
 * from. The page is `EntryListScreen`, configured with the board's copy.
 */
export function ExperienceListScreen() {
  const actions = useProfileActions();

  return (
    <EntryListScreen
      title="Work experience"
      select={selectRows}
      summary={{
        art: PROFILE_ROW_ART.experience,
        title: (count) => `${pluralize(count, 'role')} on your profile`,
        lede: LEDE,
      }}
      heading={{ title: 'Your roles', note: 'Newest first' }}
      add={{ title: 'Add a role', caption: 'Company, title, dates and the skills you used' }}
      onOpen={actions.openExperienceEntry}
      empty={{ art: PROFILE_ROW_ART.experience, title: 'No roles yet', message: LEDE }}
    />
  );
}
