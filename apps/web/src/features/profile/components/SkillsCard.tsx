import { ProfileSkillsIllustration } from '@/ui/illustrations';

import { ProfileCard } from './ProfileCard';

const CHIP = 'rounded-full bg-surface-brand px-3.5 py-1.5 text-body-s font-semibold text-brand-700';

export type SkillsCardProps = {
  skills: string[];
  /** Overview's card shows this many chips and a "+3" for the rest; the tab shows them all. */
  limit?: number;
  onViewAll?: () => void;
};

/** "Skills" (476:875): the profile's skills as lavender chips. */
export function SkillsCard({ skills, limit, onViewAll }: SkillsCardProps) {
  const shown = limit == null ? skills : skills.slice(0, limit);
  const more = skills.length - shown.length;

  return (
    <ProfileCard
      title="Skills"
      Art={ProfileSkillsIllustration}
      action={onViewAll ? { kind: 'viewAll', onClick: onViewAll } : { kind: 'edit' }}
    >
      {skills.length === 0 ? (
        <p className="mt-3 text-body-m text-text-tertiary">
          Add your skills. Job matches weigh them against every listing.
        </p>
      ) : (
        <ul className="mt-5 flex flex-wrap gap-2">
          {shown.map((skill) => (
            <li key={skill} className={CHIP}>
              {skill}
            </li>
          ))}
          {more > 0 && (
            <li className={CHIP}>
              +{more}
              <span className="sr-only"> more</span>
            </li>
          )}
        </ul>
      )}
    </ProfileCard>
  );
}
