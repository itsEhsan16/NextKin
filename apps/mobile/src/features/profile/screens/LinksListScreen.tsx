import { useCallback, useState } from 'react';

import type { Profile } from '@/data/models';
import { openExternalUrl, pluralize } from '@/lib';
import { Toast } from '@/ui/Toast';

import { EntryListScreen, type EntryListRow } from '../components/EntryListScreen';
import { linkRow } from '../entryRows';
import { useProfileActions } from '../hooks/useProfileActions';
import { PROFILE_ROW_ART } from '../profileRowArt';

const LEDE = 'A portfolio or profile gives an employer somewhere to look next.';

/** V2 §6.2: there is no supported LinkedIn API, so the app never offers to import from one. */
const NOTE = 'Paste the address yourself — LinkedIn has no import we can use.';

const UNAVAILABLE = 'Nothing on this device could open that link';

/**
 * Links (V2 §7.3, PROFILE 12 577:9018) — the portfolio and profile addresses a document can point
 * at. Each card has two targets: the card edits the link, the trailing button opens it outside the
 * app. The page is `EntryListScreen`, configured.
 */
export function LinksListScreen() {
  const actions = useProfileActions();
  const [message, setMessage] = useState<string | null>(null);

  const open = useCallback((url: string) => {
    void openExternalUrl(url).then((result) => {
      // A link nothing can handle is said out loud rather than swallowed by a silent no-op.
      if (result === 'unavailable') setMessage(UNAVAILABLE);
    });
  }, []);

  const selectRows = useCallback(
    (profile: Profile): EntryListRow[] =>
      profile.links.map((link) => ({
        ...linkRow(link),
        action: {
          icon: 'external-link-alt',
          label: `Open ${link.label}`,
          onPress: () => open(link.url),
        },
      })),
    [open],
  );

  return (
    <EntryListScreen
      title="Links"
      select={selectRows}
      summary={{
        art: PROFILE_ROW_ART.links,
        title: (count) => `${pluralize(count, 'link')} on your profile`,
        lede: LEDE,
      }}
      heading={{ title: 'Your links' }}
      add={{ title: 'Add a link', caption: 'Portfolio, LinkedIn, GitHub or a website' }}
      onOpen={actions.openLinkEntry}
      note={{ text: NOTE, icon: 'info-circle' }}
      empty={{ art: PROFILE_ROW_ART.links, title: 'No links yet', message: LEDE }}
      overlay={
        <Toast
          visible={message != null}
          message={message ?? ''}
          tone="error"
          onHide={() => setMessage(null)}
        />
      }
    />
  );
}
