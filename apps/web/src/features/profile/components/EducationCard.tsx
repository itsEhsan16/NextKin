import type { Education } from '@nextkin/shared/models';

import { ProfileEducationIllustration } from '@/ui/illustrations';

import { studyDates } from '../profileLibrary';
import { ProfileCard } from './ProfileCard';

/**
 * The Education tab, which the board names (476:42) but never opens: each qualification laid out
 * as the Experience card lays out a role, the degree over the institution and the years.
 */
export function EducationCard({ education }: { education: Education[] }) {
  return (
    <ProfileCard title="Education" Art={ProfileEducationIllustration} action={{ kind: 'edit' }}>
      {education.length === 0 ? (
        <p className="mt-3 text-body-m text-text-tertiary">
          Add your degrees and courses. Job matches read them.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {education.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-body-l font-semibold text-text-primary"
              >
                {entry.institution.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body-l font-semibold text-text-primary">
                  {entry.field ? `${entry.degree} in ${entry.field}` : entry.degree}
                </p>
                <p className="mt-0.5 text-body-m font-semibold text-text-secondary">
                  {entry.institution}
                </p>
                <p className="mt-0.5 text-body-m text-text-tertiary">
                  {studyDates(entry.startDate, entry.endDate, entry.current, entry.endPrecision)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ProfileCard>
  );
}
