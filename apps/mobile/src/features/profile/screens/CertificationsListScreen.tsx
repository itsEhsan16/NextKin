import type { Profile } from '@/data/models';

import { EntryListScreen, type EntryListRow } from '../components/EntryListScreen';
import { certificationRow } from '../entryRows';
import { useProfileActions } from '../hooks/useProfileActions';

const ADD = 'Add a certification';

// Wrapped rather than passed by reference: `map` would hand the index to the `now` argument.
const selectRows = (profile: Profile): EntryListRow[] =>
  profile.certifications.map((entry) => certificationRow(entry));

/**
 * Certifications (V2 §7.3). A lapsed credential keeps its row and says it has expired rather
 * than disappearing. No artboard (plan §8); the page is `EntryListScreen`, configured.
 */
export function CertificationsListScreen() {
  const actions = useProfileActions();

  return (
    <EntryListScreen
      title="Certifications"
      select={selectRows}
      addLabel={ADD}
      onOpen={actions.openCertificationEntry}
      empty={{
        icon: 'certificate',
        title: 'No certifications yet',
        message: 'Credentials you have earned back up the skills you list.',
        actionLabel: ADD,
      }}
    />
  );
}
