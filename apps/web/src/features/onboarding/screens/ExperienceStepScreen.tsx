'use client';

import { useProfile, useUpdatePreferences, useUpdateProfile } from '@nextkin/shared/queries';
import { useEffect } from 'react';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { showToast } from '@/lib/toast';
import { BriefcaseIcon } from '@/ui/icons';
import { Skeleton } from '@/ui/Skeleton';

import { OnboardingField } from '../components/OnboardingField';
import { OptionCard } from '../components/OptionCard';
import { QuestionLayout } from '../components/QuestionLayout';
import { bandForYears, EXPERIENCE_BANDS } from '../onboardingOptions';
import { useOnboardingStore } from '../onboardingStore';

/**
 * ONB 03 · Your experience (807:136). Starts from what the profile already says: a band saved
 * before, else the band its years fall in, and its headline as the job title. Continue saves the
 * band to the preferences and the title as the headline. The band is never written back as a
 * number of years: a band is not a count, and the profile would claim a precision nobody gave.
 */
export function ExperienceStepScreen() {
  const router = useGuardedRouter();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const updatePreferences = useUpdatePreferences();
  const { experience, jobTitle, answer } = useOnboardingStore();

  useEffect(() => {
    if (!profile.data) return;
    const seed: Parameters<typeof answer>[0] = {};
    const band =
      profile.data.preferences.experienceBand ?? bandForYears(profile.data.yearsExperience);
    if (experience === undefined && band) seed.experience = band;
    if (jobTitle === undefined) seed.jobTitle = profile.data.headline ?? '';
    if (Object.keys(seed).length > 0) answer(seed);
  }, [profile.data, experience, jobTitle, answer]);

  const title = jobTitle ?? '';
  const loading = jobTitle === undefined && profile.isPending;

  const onContinue = () => {
    if (experience && experience !== profile.data?.preferences.experienceBand) {
      updatePreferences.mutate(
        { experienceBand: experience },
        {
          onError: () =>
            showToast(
              'We couldn’t save your experience. You can change it later on your profile.',
              {
                tone: 'error',
              },
            ),
        },
      );
    }
    const headline = title.trim();
    if (headline && headline !== profile.data?.headline) {
      updateProfile.mutate(
        { headline },
        {
          onError: () =>
            showToast('We couldn’t save your job title. You can change it later on your profile.', {
              tone: 'error',
            }),
        },
      );
    }
    router.push('/onboarding/resume');
  };

  return (
    <QuestionLayout
      eyebrow="Question 3"
      title={
        <>
          How much experience
          <br />
          do you have?
        </>
      }
      help="All your working years together, roughly."
      onContinue={onContinue}
      canContinue={experience !== undefined}
      back="/onboarding/goal"
    >
      {/* The board's 3 + 2 grid (814:150, 814:151), its last cell left empty. */}
      <div role="radiogroup" aria-label="Your experience" className="grid grid-cols-3 gap-2.5">
        {EXPERIENCE_BANDS.map((band) => (
          <OptionCard
            key={band.value}
            name="experience"
            value={band.value}
            checked={experience === band.value}
            onSelect={() => answer({ experience: band.value })}
            label={band.label}
            Art={band.Art}
            tone={band.tone}
            size="sm"
          />
        ))}
      </div>
      <div className="mt-4">
        <OnboardingField
          label="Your current or last job title"
          showLabel
          value={title}
          onChange={(next) => answer({ jobTitle: next })}
          Icon={BriefcaseIcon}
          placeholder="e.g. Senior UX Designer"
          autoComplete="organization-title"
          loading={loading ? <Skeleton className="h-control-lg rounded-lg" /> : undefined}
        />
      </div>
    </QuestionLayout>
  );
}
