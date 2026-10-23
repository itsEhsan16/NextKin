import type { Experience } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { ArrowRightIcon, MoreVerticalIcon } from '@/ui/icons';
import { ProfileExperienceIllustration } from '@/ui/illustrations';
import { iconButton } from '@/ui/iconButton';

import { roleDates } from '../profileLibrary';
import { cardFooterAction, ProfileCard } from './ProfileCard';
import { Soon, soonControl } from '@/ui/Soon';

/**
 * The employer's initial on a tile (476:695, 704). The board alternates a pale tile and an ink
 * one down the list rather than drawing logos, so the page does the same by position.
 */
function InitialTile({ company, index }: { company: string; index: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-md text-body-l font-semibold',
        index % 2 === 0 ? 'bg-neutral-100 text-text-primary' : 'bg-neutral-900 text-neutral-0',
      )}
    >
      {company.charAt(0).toUpperCase()}
    </span>
  );
}

export type ExperienceCardProps = {
  roles: Experience[];
  /** Overview's card: the first roles, "View all" and "Manage experience" open the tab. */
  onViewAll?: () => void;
};

/**
 * "Experience" (476:664): each role with its employer's initial, the dates and how long, and a
 * line on what it was. The kebab is drawn without a menu behind it, so it is inert until one is.
 */
export function ExperienceCard({ roles, onViewAll }: ExperienceCardProps) {
  return (
    <ProfileCard
      title="Experience"
      Art={ProfileExperienceIllustration}
      action={onViewAll ? { kind: 'viewAll', onClick: onViewAll } : { kind: 'edit' }}
    >
      {roles.length === 0 ? (
        <p className="mt-3 text-body-m text-text-tertiary">
          Add the roles you&apos;ve held. Job matches and tailored resumes draw on them.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-5">
          {roles.map((role, index) => (
            <li key={role.id} className="flex items-start gap-3.5">
              <InitialTile company={role.company} index={index} />
              <div className="min-w-0 flex-1">
                <p className="text-body-l font-semibold text-text-primary">{role.title}</p>
                <p className="mt-0.5 text-body-m font-semibold text-text-secondary">
                  {role.company}
                </p>
                <p className="mt-0.5 whitespace-pre text-body-m text-text-tertiary">
                  {roleDates(role)}
                </p>
                {role.summary && (
                  <p className="mt-0.5 text-body-m text-text-tertiary">{role.summary}</p>
                )}
              </div>
              <Soon>
                <button
                  aria-disabled="true"
                  type="button"
                  aria-label={`More for ${role.title} at ${role.company}`}
                  className={cn(
                    soonControl,
                    iconButton,
                    '-mr-2 -mt-1 shrink-0 text-text-secondary',
                  )}
                >
                  <MoreVerticalIcon className="size-4" />
                </button>
              </Soon>
            </li>
          ))}
        </ul>
      )}
      {onViewAll && (
        <button type="button" onClick={onViewAll} className={cardFooterAction}>
          Manage experience
          <ArrowRightIcon className="size-4" />
        </button>
      )}
    </ProfileCard>
  );
}
