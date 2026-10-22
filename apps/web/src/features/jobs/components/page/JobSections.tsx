'use client';

import type { Job, Profile } from '@nextkin/shared/models';
import { useUpdateSkills } from '@nextkin/shared/queries';
import type { ComponentType, ReactNode, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import {
  CalendarIcon,
  CheckCircleIcon,
  GlobeIcon,
  LocationOutlineIcon,
  PeopleIcon,
  PlusIcon,
} from '@/ui/icons';
import {
  InsightsStarIllustration,
  ProfileCompanyIllustration,
  ProfileGoalsIllustration,
  ProfileSkillsIllustration,
} from '@/ui/illustrations';
import { pressable } from '@/ui/pressable';

import { hasSkill, siteLabel } from '../../jobPageLibrary';

type Art = ComponentType<SVGProps<SVGSVGElement>>;

/** One of the page's sections (730:…): a rule above, the board's art and the heading, then it. */
export function JobSection({
  id,
  Art,
  title,
  aside,
  children,
}: {
  id: string;
  Art: Art;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-t border-border-faint px-6 py-6">
      <div className="flex items-center gap-3">
        <Art aria-hidden className="h-auto w-9 shrink-0" />
        <h2 id={id} className="flex-1 text-title-l text-text-primary">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A bulleted list in the page's prose size. */
export function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-body-m text-text-secondary">
          <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-neutral-400" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Responsibilities({ job }: { job: Job }) {
  // A job description may state none; its page leaves the section out rather than show it empty.
  if (job.responsibilities.length === 0) return null;
  return (
    <JobSection id="job-responsibilities" Art={ProfileGoalsIllustration} title="Responsibilities">
      <Bullets items={job.responsibilities} />
    </JobSection>
  );
}

/**
 * Qualifications (730:…): the job's skills against the profile — on it in green, missing in dashed
 * amber — then what the listing requires. A missing skill the user has is one click from their
 * profile; nothing is added that they did not pick.
 */
export function Qualifications({ job, profile }: { job: Job; profile: Profile | undefined }) {
  const update = useUpdateSkills();
  const add = (skill: string) => {
    if (!profile || update.isPending) return;
    update.mutate([...profile.skills, skill], {
      onSuccess: () => showToast(`${skill} added to your profile.`),
      onError: () => showToast(`Couldn't add ${skill}. Try again.`, { tone: 'error' }),
    });
  };

  if (job.tags.length === 0 && job.requirements.length === 0) return null;
  return (
    <JobSection
      id="job-qualifications"
      Art={ProfileSkillsIllustration}
      title="Qualifications"
      aside={
        <span className="flex items-center gap-1.5 text-body-s text-text-tertiary">
          <CheckCircleIcon aria-hidden className="size-3.5 text-success-600" />
          On your profile
        </span>
      }
    >
      <p className="text-body-s text-text-secondary">
        See how your skills line up with this job. Missed one you have?{' '}
        <span className="font-semibold text-text-primary">Click it</span> to add it to your profile.
      </p>
      <ul aria-label="Skills this job asks for" className="mt-3 flex flex-wrap gap-2">
        {job.tags.map((skill) =>
          hasSkill(profile, skill) ? (
            <li
              key={skill}
              className="flex items-center gap-1.5 rounded-sm bg-success-surface px-2 py-1 text-caption-m font-medium text-success-text animate-pop-in"
            >
              <CheckCircleIcon aria-hidden className="size-3" />
              {skill}
            </li>
          ) : (
            <li key={skill}>
              <button
                type="button"
                onClick={() => add(skill)}
                disabled={!profile || update.isPending}
                aria-label={`Add ${skill} to your profile`}
                className={cn(
                  pressable,
                  'flex items-center gap-1.5 rounded-sm border border-dashed border-warning-text/60 bg-warning-50/50 px-2 py-1 text-caption-m font-medium text-warning-text',
                  'not-disabled:hover:bg-warning-50 disabled:opacity-60',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                )}
              >
                <PlusIcon aria-hidden className="size-3" />
                {skill}
              </button>
            </li>
          ),
        )}
      </ul>
      {job.requirements.length > 0 && (
        <>
          <h3 className="mt-5 text-body-m font-semibold text-text-primary">Required</h3>
          <div className="mt-2">
            <Bullets items={job.requirements} />
          </div>
        </>
      )}
    </JobSection>
  );
}

export function Benefits({ job }: { job: Job }) {
  if (!job.benefits?.length) return null;
  return (
    <JobSection id="job-benefits" Art={InsightsStarIllustration} title="Benefits">
      <Bullets items={job.benefits} />
    </JobSection>
  );
}

/** "Company" (730:…): what the employer does, and the facts the listing gives. */
export function CompanySection({ job }: { job: Job }) {
  const facts: { key: string; Icon: Art; label: ReactNode }[] = [
    ...(job.companyFounded
      ? [{ key: 'founded', Icon: CalendarIcon, label: `Founded ${job.companyFounded}` }]
      : []),
    ...(job.companyHeadquarters
      ? [{ key: 'hq', Icon: LocationOutlineIcon, label: job.companyHeadquarters }]
      : []),
    { key: 'size', Icon: PeopleIcon, label: job.companySize },
    {
      key: 'site',
      Icon: GlobeIcon,
      label: (
        <a
          href={`https://${siteLabel(job.companyWebsite)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-sm text-text-brand transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {siteLabel(job.companyWebsite)}
        </a>
      ),
    },
  ];
  return (
    <JobSection id="job-company" Art={ProfileCompanyIllustration} title="Company">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="rounded-md bg-neutral-50 p-4">
          <p className="text-body-l font-semibold text-text-primary">{job.company}</p>
          <p className="mt-1.5 text-body-s text-text-secondary">{job.companyAbout}</p>
        </div>
        <ul className="flex flex-col gap-2 rounded-md bg-neutral-50 p-4">
          {facts.map(({ key, Icon, label }) => (
            <li key={key} className="flex items-center gap-2 text-body-s text-text-secondary">
              <Icon aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-micro text-text-tertiary">
        Company details come from the job listing.
      </p>
    </JobSection>
  );
}
