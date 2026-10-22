import type { Profile, User } from '@nextkin/shared/models';
import type { ComponentType, SVGProps } from 'react';

import { AVAILABILITY_PILL, displayUrl } from '@/features/account/accountLibrary';
import {
  CameraIcon,
  GlobeIcon,
  LinkIcon,
  LocationOutlineIcon,
  MailIcon,
  PhoneIcon,
} from '@/ui/icons';
import { Tag } from '@/ui/Tag';
import { UserAvatar } from '@/ui/UserAvatar';

import { ProfileCard } from './ProfileCard';
import { Soon, soonControl } from '@/ui/Soon';
import { cn } from '@/lib/cn';

type ContactItem = { key: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; label: string };

/**
 * "Profile information" (476:71): the photo, the name and title, whether George is looking, how to
 * reach him, and his motto on the right. The contact lines run two to a row, as drawn, each
 * column as wide as its longest line, and cut short only when the card is narrower than both.
 */
export function ProfileInfoCard({ user, profile }: { user: User; profile: Profile }) {
  const name = `${user.firstName} ${user.lastName}`;
  const website = profile.links.find(
    (link) => link.kind === 'website' || link.kind === 'portfolio',
  );
  const linkedin = profile.links.find((link) => link.kind === 'linkedin');
  // The board's order, row by row: place and phone, email and website, then LinkedIn.
  const contact: ContactItem[] = [
    ...(profile.location
      ? [{ key: 'location', Icon: LocationOutlineIcon, label: profile.location }]
      : []),
    ...(profile.phone ? [{ key: 'phone', Icon: PhoneIcon, label: profile.phone }] : []),
    { key: 'email', Icon: MailIcon, label: user.email },
    ...(website ? [{ key: 'website', Icon: GlobeIcon, label: displayUrl(website.url) }] : []),
    ...(linkedin ? [{ key: 'linkedin', Icon: LinkIcon, label: displayUrl(linkedin.url) }] : []),
  ];

  return (
    <ProfileCard
      title="Profile information"
      description="This information is used across your applications, resumes, and AI suggestions."
      action={{ kind: 'edit' }}
    >
      <div className="mt-5 flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="relative shrink-0">
          <UserAvatar
            name={name}
            avatarUrl={user.avatarUrl}
            className="size-26 rounded-full bg-neutral-100 text-h1"
          />
          {/* Drawn (476:123) with no picker behind it; inert until uploads exist. */}
          <Soon>
            <button
              aria-disabled="true"
              type="button"
              aria-label="Change profile photo"
              className={cn(
                'absolute bottom-1 right-0 flex size-7 items-center justify-center rounded-full border border-border-faint bg-surface-card text-text-secondary shadow-card transition-colors duration-press ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                soonControl,
              )}
            >
              <CameraIcon className="size-3.5" />
            </button>
          </Soon>
        </div>

        <div className="min-w-[260px] flex-1">
          <h3 className="text-display-l font-extrabold text-text-primary">{name}</h3>
          {profile.headline && (
            <p className="mt-0.5 text-body-l text-text-tertiary">{profile.headline}</p>
          )}
          <Tag tone="success" shape="pill" className="mt-2.5 gap-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-success-600" />
            {AVAILABILITY_PILL[profile.preferences.availability]}
          </Tag>

          <ul
            aria-label="Contact details"
            className="mt-4 grid grid-cols-[minmax(0,max-content)_minmax(0,max-content)] gap-x-7 gap-y-2.5"
          >
            {contact.map(({ key, Icon, label }) => (
              <li
                key={key}
                className="flex min-w-0 items-center gap-2.5 text-body-l text-text-secondary"
              >
                <Icon className="size-4 shrink-0 text-brand-600" />
                <span className="truncate">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {profile.tagline && (
          <figure className="w-40 shrink-0 pt-1">
            <span aria-hidden className="block h-0.5 w-11 bg-border-brand-strong" />
            <blockquote className="mt-3 text-prose text-text-secondary">
              “{profile.tagline}”
            </blockquote>
          </figure>
        )}
      </div>
    </ProfileCard>
  );
}
