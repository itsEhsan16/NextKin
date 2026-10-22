import type { Profile } from '@/data/models';
import type { FlowArt } from '@/features/create/components/FlowHero';
import { pluralize } from '@/lib';

import { EntryListScreen, type EntryListRow } from '../components/EntryListScreen';
import { certificationRow } from '../entryRows';
import { useProfileActions } from '../hooks/useProfileActions';
import { PROFILE_ROW_ART } from '../profileRowArt';

const LEDE = 'Credentials you have earned back up the skills you list.';

/** PROFILE 10's drawing (680:107), the board's 3× render: the certificate with its rosette. */
const EMPTY_IMAGE: FlowArt = {
  source: require('../../../../assets/illustrations/profile/certifications-empty.png'),
  w: 300,
  h: 205,
  shiftX: 0,
  toTitle: 22, // 680:107 → 573:134, the empty state's own title gap
};

// Wrapped rather than passed by reference: `map` would hand the index to the `now` argument.
const selectRows = (profile: Profile): EntryListRow[] =>
  profile.certifications.map((entry) => certificationRow(entry));

/**
 * Certifications (V2 §7.3, PROFILE 10 573:119). The board draws the empty state, which is what the
 * fixture profile shows; a filled list is the role list's shape. A lapsed credential keeps its
 * card and says it has expired rather than disappearing.
 */
export function CertificationsListScreen() {
  const actions = useProfileActions();

  return (
    <EntryListScreen
      title="Certifications"
      select={selectRows}
      summary={{
        art: PROFILE_ROW_ART.certifications,
        title: (count) => `${pluralize(count, 'certification')} on your profile`,
        lede: LEDE,
      }}
      heading={{ title: 'Your certifications' }}
      add={{ title: 'Add a certification', caption: 'Name, issuer, dates and a credential link' }}
      onOpen={actions.openCertificationEntry}
      empty={{
        art: PROFILE_ROW_ART.certifications,
        image: EMPTY_IMAGE,
        title: 'No certifications yet',
        message: LEDE,
        footnote: 'AWS, Google, a course certificate — anything with an issuer counts.',
      }}
    />
  );
}
