import { useCallback, useState } from 'react';

import type { Profile } from '@/data/models';
import { openExternalUrl } from '@/lib';
import { Toast } from '@/ui/Toast';

import { EntryListScreen, type EntryListRow } from '../components/EntryListScreen';
import { linkRow } from '../entryRows';
import { useProfileActions } from '../hooks/useProfileActions';

const ADD = 'Add a link';

/** V2 §6.2: there is no supported LinkedIn API, so the app never offers to import from one. */
const NOTE = 'Paste the address yourself — LinkedIn has no import we can use.';

const UNAVAILABLE = 'Nothing on this device could open that link';

/**
 * Links (V2 §7.3) — the portfolio and profile addresses a document can point at. Each row has
 * two targets: the row edits the link, the trailing button opens it outside the app. No
 * artboard (plan §8); the page is `EntryListScreen`, configured.
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
      addLabel={ADD}
      onOpen={actions.openLinkEntry}
      note={NOTE}
      empty={{
        icon: 'link',
        title: 'No links yet',
        message: 'A portfolio or profile gives an employer somewhere to look next.',
        actionLabel: ADD,
      }}
      overlay={
        <Toast
          visible={message != null}
          message={message ?? ''}
          icon="exclamation-triangle"
          onHide={() => setMessage(null)}
        />
      }
    />
  );
}
