'use client';

import type { JdDraft, Profile } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { CheckCircle } from '@/ui/lineIcons';
import { ProfileSkillsIllustration } from '@/ui/illustrations';

import { hasSkill } from '../../jobs/jobPageLibrary';
import { Bullets, JobSection } from '../../jobs/components/page/JobSections';

const lower = (text: string) => text.trim().toLowerCase();
const YEARS_OR_DEGREE =
  /\b(?:\d+\s*\+?\s*(?:years?|yrs)|bachelor|master|degree|diploma|ph\.?\s?d|graduate)\b/i;

/**
 * What a job description asks for (toreview §110.5), read-only: its required skills, the ones it
 * would like, and its tools, each marked when it is already on the user's profile; then the
 * qualification lines the text states that are not just a skill name (a degree, years of
 * experience). Nothing is added from here: tailoring compares a resume with the job and asks about
 * each missing skill there, so a skill is added once, where it counts.
 */
export function JdSkills({
  draft,
  lines,
  profile,
}: {
  draft: JdDraft;
  /** The text's own qualification lines (`jobFromJd`). */
  lines: readonly string[];
  profile: Profile | undefined;
}) {
  // Each skill once, in the strongest list that names it: a JD's reading often repeats its
  // required skills among its tools.
  const seen = new Set<string>();
  const once = (skills: readonly string[]) =>
    skills.filter((skill) => !seen.has(lower(skill)) && Boolean(seen.add(lower(skill))));
  const groups = [
    { key: 'required', label: 'Required', skills: once(draft.requiredSkills) },
    { key: 'preferred', label: 'Nice to have', skills: once(draft.preferredSkills) },
    { key: 'tools', label: 'Tools', skills: once(draft.tools) },
  ].filter((group) => group.skills.length > 0);
  // A line adds something the chips do not when it states years or a degree, or names none of
  // them; "Strong knowledge of HTML5 and CSS3" only repeats them.
  const qualifications = lines.filter((line) => {
    const text = lower(line);
    if (text.split(/\s+/).length < 3) return false;
    if (YEARS_OR_DEGREE.test(text)) return true;
    return ![...seen].some((skill) => text.includes(skill));
  });
  if (groups.length === 0 && qualifications.length === 0) return null;

  return (
    <JobSection
      id="jd-skills"
      Art={ProfileSkillsIllustration}
      title="What this job asks for"
      aside={
        profile ? (
          <span className="flex items-center gap-1.5 text-body-s text-text-tertiary">
            <CheckCircle aria-hidden className="size-4.5 text-success-600" />
            Already on your profile
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.key}>
            <h3 className="text-body-s font-semibold text-text-primary">
              {group.label}{' '}
              <span className="font-normal text-text-tertiary">· {group.skills.length}</span>
            </h3>
            <ul aria-label={`${group.label} skills`} className="mt-2 flex flex-wrap gap-2">
              {group.skills.map((skill) => {
                const own = hasSkill(profile, skill);
                return (
                  <li
                    key={skill}
                    className={cn(
                      'flex items-center gap-1.5 rounded-sm border px-2 py-1 text-caption-m font-medium',
                      own
                        ? 'border-transparent bg-success-surface text-success-text'
                        : 'border-border-default bg-surface-card text-text-secondary',
                    )}
                  >
                    {own && <CheckCircle aria-hidden className="size-4" />}
                    {skill}
                    {own && <span className="sr-only">(on your profile)</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {qualifications.length > 0 && (
          <div>
            <h3 className="text-body-s font-semibold text-text-primary">Qualifications</h3>
            <div className="mt-2">
              <Bullets items={qualifications} />
            </div>
          </div>
        )}
        <p className="text-body-s text-text-tertiary">
          Tailoring compares your resume with these and asks before adding any that are missing.
        </p>
      </div>
    </JobSection>
  );
}
