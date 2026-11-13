import type { CoverLetterDetails, Profile, User } from '@nextkin/shared/models';
import type { ComponentType, SVGProps } from 'react';

import { displayUrl } from '@/features/account/accountLibrary';
import { LinkIcon, LocationOutlineIcon, MailIcon, PhoneIcon } from '@/ui/icons';

type Line = { key: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; label: string };

/**
 * A cover letter set as a page (563:1722): the sender's name, the headline it was written under
 * and their contact lines, a rule, the addressee, the "Re:" line, then the letter. The contact
 * lines are the account's own, so they follow the profile; the rest is the letter's.
 */
export function LetterSheet({
  letter,
  user,
  profile,
}: {
  letter: CoverLetterDetails;
  user: User;
  profile: Profile | undefined;
}) {
  const name = `${user.firstName} ${user.lastName}`;
  const linkedin = profile?.links.find((link) => link.kind === 'linkedin');
  // The board's order: email, phone and place on one line, LinkedIn on the next.
  const first: Line[] = [
    { key: 'email', Icon: MailIcon, label: user.email },
    ...(profile?.phone ? [{ key: 'phone', Icon: PhoneIcon, label: profile.phone }] : []),
    ...(profile?.location
      ? [{ key: 'location', Icon: LocationOutlineIcon, label: profile.location }]
      : []),
  ];

  return (
    <article
      aria-label={`${letter.company} cover letter`}
      className="mx-auto flex aspect-[540/764] w-full max-w-sheet flex-col rounded-sm border border-border-default bg-surface-card px-[9.6%] py-[9.3%] shadow-card"
    >
      <p className="text-h1 font-bold text-text-primary">{name}</p>
      <p className="mt-0.5 text-body-m font-medium text-text-secondary">{letter.senderHeadline}</p>
      <ul className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-micro font-normal text-text-tertiary">
        {first.map(({ key, Icon, label }) => (
          <li key={key} className="flex items-center gap-1.5">
            <Icon aria-hidden className="size-2.5 shrink-0 text-neutral-400" />
            {label}
          </li>
        ))}
        {linkedin && (
          <li className="flex basis-full items-center gap-1.5">
            <LinkIcon aria-hidden className="size-2.5 shrink-0 text-neutral-400" />
            {displayUrl(linkedin.url)}
          </li>
        )}
      </ul>

      <hr className="my-4.5 border-border-default" />

      <p className="text-body-s font-semibold text-text-primary">{letter.company}</p>
      <p className="text-body-s text-text-secondary">{letter.location}</p>
      <p className="mt-3.5 text-body-s font-semibold text-text-primary">
        Re: {letter.role}
        {letter.jobRef ? ` (${letter.jobRef})` : ''}
      </p>

      <div className="mt-4 flex flex-col gap-2.5 text-body-s leading-5 text-text-secondary">
        <p className="text-text-primary">{letter.salutation}</p>
        {letter.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <p className="mt-4 text-body-s leading-5 text-text-secondary">{letter.signOff}</p>
      <p className="mt-1 text-body-s font-semibold leading-5 text-text-primary">{name}</p>
    </article>
  );
}
