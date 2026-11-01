import type { Profile } from '@/data/models';
import { pluralize } from '@/lib';

import { EntryListScreen, type EntryListRow } from '../components/EntryListScreen';
import { educationRow, newestFirst } from '../entryRows';
import { useProfileActions } from '../hooks/useProfileActions';
import { PROFILE_ROW_ART } from '../profileRowArt';

const LEDE = 'A degree or a course gives a recruiter the rest of the picture.';

const selectRows = (profile: Profile): EntryListRow[] =>
  newestFirst(profile.education).map(educationRow);

/** Education (V2 §7.3, PROFILE 07 577:6868). The page is `EntryListScreen`, configured. */
export function EducationListScreen() {
  const actions = useProfileActions();

  return (
    <EntryListScreen
      title="Education"
      kind="education"
      select={selectRows}
      summary={{
        art: PROFILE_ROW_ART.education,
        title: (count) => `${pluralize(count, 'qualification')} on your profile`,
        lede: LEDE,
      }}
      heading={{ title: 'Your education', note: 'Newest first' }}
      add={{ title: 'Add education', caption: 'School, qualification, field and dates' }}
      onOpen={actions.openEducationEntry}
      empty={{ art: PROFILE_ROW_ART.education, title: 'No education yet', message: LEDE }}
    />
  );
}
