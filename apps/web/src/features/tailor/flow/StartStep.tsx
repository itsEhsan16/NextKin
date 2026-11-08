'use client';

import type { Job, Profile } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import {
  backButton,
  FlowFooter,
  primaryButton,
  StepHeading,
  stepCard,
} from '@/features/create/jobFlow/FlowChrome';
import { OptionCard, OtherWayRow } from '@/features/create/jobFlow/FlowRows';
import { useResumeUpload } from '@/features/create/jobFlow/useResumeUpload';
import { RESUME_INPUT_ACCEPT } from '@/features/onboarding/resumeUpload';
import { ArrowRight, UploadCloud02 } from '@/ui/lineIcons';
import {
  JdArtUploadFileIllustration,
  NavDocumentsIllustration,
  ProfileEducationIllustration,
  ProfileExperienceIllustration,
  ProfileSkillsIllustration,
} from '@/ui/illustrations';

const ART = {
  build: '/illustrations/flow/build.png',
  zero: '/illustrations/flow/zero.png',
  profile: '/illustrations/flow/profile.png',
  upload: '/illustrations/flow/upload.png',
};
const ZERO_LINE =
  'Tell us your role and years. We write a first draft and mark every guess for you to check.';
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

type Common = {
  job: Job;
  profile: Profile | undefined;
  /** Builds from the profile: on to the comparison. */
  onBuild: () => void;
  zeroHref: Route;
  backHref: Route;
};

function profileChips(profile: Profile) {
  const school = profile.education[0];
  const year = school?.endDate?.slice(0, 4);
  return [
    {
      key: 'roles',
      art: <ProfileExperienceIllustration className="h-auto w-6" />,
      label: plural(profile.experiences.length, 'role'),
    },
    {
      key: 'skills',
      art: <ProfileSkillsIllustration className="h-auto w-6" />,
      label: plural(profile.skills.length, 'skill'),
    },
    ...(school
      ? [
          {
            key: 'school',
            art: <ProfileEducationIllustration className="h-auto w-6" />,
            label:
              [school.degree, school.institution].filter(Boolean).join(' · ') +
              (year ? `, ${year}` : ''),
          },
        ]
      : []),
  ];
}

/**
 * W-FLOW 02b and 02b·2 (849:625, 849:926), step 2 from Build Resume: a new resume built from the
 * profile for this job — or, with no roles in the profile, Zero Resume or the profile first. The
 * other ways in (tailor one you have, upload one) sit beside it.
 */
export function BuildStep({
  job,
  profile,
  onBuild,
  zeroHref,
  backHref,
  resumeCount,
  tailorHref,
}: Common & { resumeCount: number; tailorHref: Route }) {
  const router = useRouter();
  const hasRoles = (profile?.experiences.length ?? 0) > 0;
  const [pick, setPick] = useState<'zero' | 'profile'>('zero');
  const title = `${job.company ? `${job.company}’s ` : ''}${job.title} job`;

  const next = () => {
    if (hasRoles) onBuild();
    else router.push(pick === 'zero' ? zeroHref : ('/profile' as Route));
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="build-step" className={stepCard}>
        <div className="px-8 pb-2 pt-8">
          <StepHeading
            id="build-step"
            step={2}
            of={4}
            title="Build a new resume for this job"
            lede={
              hasRoles
                ? 'We write it from your profile — only what you’ve told us. Nothing is made up.'
                : 'Your profile has no roles yet, so there’s nothing to build from. Pick one of these to start.'
            }
          />
        </div>
        <div className="flex flex-col gap-6 px-8 pb-8 pt-6 lg:flex-row">
          <div role="radiogroup" aria-label="How to build it" className="flex min-w-0 flex-1 gap-4">
            {hasRoles && profile ? (
              <OptionCard
                wide
                art={ART.build}
                title="Build one from my profile"
                on
                onPick={() => undefined}
              >
                <p className="text-body-l text-text-secondary">
                  We use your roles, skills and education, then aim them at {title}. You choose
                  which missing keywords to add in step 4.
                </p>
                <ul className="relative flex flex-wrap gap-2.5">
                  {profileChips(profile).map((chip) => (
                    <li
                      key={chip.key}
                      className="flex items-center gap-2 rounded-full border border-border-default bg-surface-card py-1.5 pl-2 pr-3.5 text-body-m font-semibold text-neutral-700"
                    >
                      <span aria-hidden>{chip.art}</span>
                      {chip.label}
                    </li>
                  ))}
                </ul>
                <Link
                  href={'/profile' as Route}
                  className="relative self-start rounded-sm text-body-m font-semibold text-text-brand underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Check my profile first
                </Link>
              </OptionCard>
            ) : (
              <>
                <OptionCard
                  art={ART.zero}
                  title="Start from nothing"
                  pill="Zero Resume"
                  on={pick === 'zero'}
                  onPick={() => setPick('zero')}
                >
                  <p className="text-body-l text-text-secondary">{ZERO_LINE}</p>
                </OptionCard>
                <OptionCard
                  art={ART.profile}
                  title="Fill in my profile"
                  on={pick === 'profile'}
                  onPick={() => setPick('profile')}
                >
                  <p className="text-body-l text-text-secondary">
                    Add your roles once. Every resume you make after that uses them.
                  </p>
                </OptionCard>
              </>
            )}
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-90">
            <h2 className="text-body-l font-bold text-text-primary">Or start another way</h2>
            {resumeCount > 0 && (
              <OtherWayRow
                art={<NavDocumentsIllustration className="h-auto w-9" />}
                title="Tailor a resume I already have"
                line={`Start from one of your ${plural(resumeCount, 'resume')}`}
                href={tailorHref}
              />
            )}
            <OtherWayRow
              art={<JdArtUploadFileIllustration className="h-auto w-9" />}
              title="Upload a resume"
              line="PDF or DOCX — we keep its own sections"
              href={tailorHref}
            />
          </div>
        </div>
      </section>

      <FlowFooter
        note={
          hasRoles
            ? 'Your profile isn’t changed. Nothing is spent until you create the resume.'
            : 'Nothing is spent until you create the resume.'
        }
      >
        <Link href={backHref} className={backButton}>
          Back
        </Link>
        <button type="button" onClick={next} disabled={!profile} className={primaryButton}>
          Continue
          <ArrowRight aria-hidden className="size-4.5" />
        </button>
      </FlowFooter>
    </div>
  );
}

/**
 * W-FLOW 02c (849:1115), step 2 with no resume on NextKin: upload one, build one from the profile,
 * or start from nothing — whichever way, aimed at this job.
 */
export function NoResumeStep({
  job,
  profile,
  onBuild,
  zeroHref,
  backHref,
  onUploaded,
}: Common & { onUploaded: (resumeId: string) => void }) {
  const router = useRouter();
  const hasRoles = (profile?.experiences.length ?? 0) > 0;
  const [pick, setPick] = useState<'upload' | 'build' | 'zero'>('upload');
  const upload = useResumeUpload(onUploaded);
  const input = useRef<HTMLInputElement>(null);
  const company = job.company ? `${job.company}’s` : 'this';

  const next = () => {
    if (pick === 'upload') input.current?.click();
    else if (pick === 'build') onBuild();
    else router.push(zeroHref);
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="start-step" className={stepCard}>
        <div className="px-8 pb-2 pt-8">
          <StepHeading
            id="start-step"
            step={2}
            of={4}
            title="Let’s get you a resume for this job"
            lede={`You don’t have a resume on NextKin yet. Pick one way to start — we’ll aim it at ${company} job either way.`}
          />
        </div>
        <div
          role="radiogroup"
          aria-label="How to start"
          className="flex flex-col gap-4 px-8 pb-8 pt-6 lg:flex-row"
        >
          <OptionCard
            art={ART.upload}
            title="Upload your resume"
            on={pick === 'upload'}
            onPick={() => setPick('upload')}
          >
            <p className="text-body-l text-text-secondary">
              PDF or DOCX. We read it and keep its own sections and order.
            </p>
            <button
              type="button"
              disabled={upload.reading}
              onClick={() => {
                setPick('upload');
                input.current?.click();
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) upload.pick(file);
              }}
              className="relative flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-brand-strong bg-surface-brand py-2 pl-3 pr-3.5 text-body-m font-semibold text-text-brand transition-colors duration-press ease-standard hover:border-brand-600 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <UploadCloud02 aria-hidden className="size-4.5 shrink-0" />
              <span
                title={upload.reading ? (upload.name ?? undefined) : undefined}
                className="min-w-0 truncate"
              >
                {upload.reading ? `Reading ${upload.name}…` : 'Drop a file here, or browse'}
              </span>
            </button>
            {upload.error && (
              <p role="alert" className="relative text-body-m text-danger-600">
                {upload.error}
              </p>
            )}
          </OptionCard>
          <OptionCard
            art={ART.build}
            title="Build from my profile"
            on={pick === 'build'}
            onPick={() => hasRoles && setPick('build')}
          >
            <p className="text-body-l text-text-secondary">
              {hasRoles && profile
                ? `Uses the ${plural(profile.experiences.length, 'role')}, ${plural(profile.skills.length, 'skill')}${profile.education.length ? ' and education' : ''} in your profile.`
                : 'Your profile has no roles yet. Add them on your profile first.'}
            </p>
          </OptionCard>
          <OptionCard
            art={ART.zero}
            title="Start from nothing"
            pill="Zero Resume"
            on={pick === 'zero'}
            onPick={() => setPick('zero')}
          >
            <p className="text-body-l text-text-secondary">{ZERO_LINE}</p>
          </OptionCard>
        </div>
        <input
          ref={input}
          type="file"
          accept={RESUME_INPUT_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Resume file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.pick(file);
            event.target.value = '';
          }}
        />
      </section>

      <FlowFooter note="Nothing is spent until you create the resume.">
        <Link href={backHref} className={backButton}>
          Back
        </Link>
        <button type="button" onClick={next} disabled={upload.reading} className={primaryButton}>
          Continue
          <ArrowRight aria-hidden className="size-4.5" />
        </button>
      </FlowFooter>
    </div>
  );
}
