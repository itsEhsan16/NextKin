import type { Profile } from '@/data/models';

import { EntryListScreen, type EntryListRow } from '../components/EntryListScreen';
import { educationRow } from '../entryRows';
import { useProfileActions } from '../hooks/useProfileActions';

const ADD = 'Add education';

const selectRows = (profile: Profile): EntryListRow[] => profile.education.map(educationRow);

/**
 * Education (V2 §7.3). No artboard (plan §8); the page is `EntryListScreen`, configured.
 */
export function EducationListScreen() {
  const actions = useProfileActions();

  return (
    <EntryListScreen
      title="Education"
      select={selectRows}
      addLabel={ADD}
      onOpen={actions.openEducationEntry}
      empty={{
        icon: 'graduation-cap',
        title: 'No education yet',
        message: 'A degree or a course gives a recruiter the rest of the picture.',
        actionLabel: ADD,
      }}
    />
  );
}
