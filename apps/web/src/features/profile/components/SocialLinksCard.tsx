import type { LinkKind, Profile } from '@nextkin/shared/models';

import { displayUrl } from '@/features/account/accountLibrary';
import { ProfileLanguageIllustration, ProfileLinksIllustration } from '@/ui/illustrations';

import { ProfileCard } from './ProfileCard';

/** A site gets the globe (476:1051); anything else, the chain (476:1037). */
const isSite = (kind: LinkKind | undefined): boolean => kind === 'website' || kind === 'portfolio';

/** "Social links" (476:1014): each link a chip, opening in a new tab. */
export function SocialLinksCard({ profile }: { profile: Profile }) {
  return (
    <ProfileCard title="Social links" Art={ProfileLinksIllustration} action={{ kind: 'edit' }}>
      {profile.links.length === 0 ? (
        <p className="mt-3 text-body-m text-text-tertiary">
          Add your LinkedIn, portfolio or site. Recruiters look for them.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col items-start gap-2.5">
          {profile.links.map((link) => {
            const Art = isSite(link.kind) ? ProfileLanguageIllustration : ProfileLinksIllustration;
            return (
              <li key={link.id} className="max-w-full">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-control-md items-center gap-2 rounded-md border border-border-faint px-3 text-body-m font-semibold text-text-secondary transition-colors duration-press ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <Art aria-hidden className="h-auto max-h-4.5 w-6 shrink-0" />
                  <span className="truncate">{displayUrl(link.url)}</span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </ProfileCard>
  );
}
