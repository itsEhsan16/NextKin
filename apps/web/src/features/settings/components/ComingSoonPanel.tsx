import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { StateView } from '@/ui/StateView';

import { SETTINGS_SECTIONS, type SettingsSection } from '../settingsLibrary';
import { SECTION_ICON } from './SettingsNav';

/**
 * What an undrawn section shows (254:1020-1077): its row's glyph and a note that it isn't built,
 * in the words of the app's other placeholders. The header above names the section, as it does
 * for the two drawn ones (`toreview.md` §22), so the card doesn't repeat the name. By your call
 * these wait for their boards rather than borrowing the Account page's versions of the same
 * settings (§21); each is replaced wholesale when its board lands.
 */
export function ComingSoonPanel({ section }: { section: SettingsSection }) {
  const Icon = SECTION_ICON[section];

  return (
    <section
      aria-label={`${SETTINGS_SECTIONS[section].label}, coming soon`}
      className={cn(cardSurface, 'flex flex-col items-center pt-12 pb-4')}
    >
      <Icon aria-hidden className="h-auto max-h-10 w-12" />
      <StateView
        title="Coming soon"
        message="Not built yet. This section lands when its artboard does."
        className="pt-3"
      />
    </section>
  );
}
