'use client';

import { useProfile, useUpsertEducation } from '@nextkin/shared/queries';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { ApartmentIcon, ChevronRightIcon, SchoolIcon } from '@/ui/icons';
import { pressable } from '@/ui/pressable';
import { Skeleton } from '@/ui/Skeleton';

import { OnboardingField } from '../components/OnboardingField';
import { QuestionLayout } from '../components/QuestionLayout';
import { YearField } from '../components/YearField';
import {
  educationBlank,
  educationChanged,
  educationComplete,
  educationFromEntry,
  emptyEducation,
  entryFromEducation,
  latestEducation,
} from '../education';
import { useOnboardingStore, type EducationAnswer } from '../onboardingStore';

const NEXT = '/onboarding/done';

/**
 * ONB 07 · Your education (808:266), the last quick question, and optional. Starts from the
 * profile's latest qualification, if it has one. "Create my starting point" saves it to the
 * profile, as the profile's own editor does, and goes on to ONB 08; left blank, or with "Skip this
 * question", nothing is saved.
 */
export function EducationStepScreen() {
  const router = useRouter();
  const profile = useProfile();
  const upsert = useUpsertEducation();
  const { education, answer } = useOnboardingStore();

  useEffect(() => {
    if (education !== undefined || !profile.data) return;
    const latest = latestEducation(profile.data.education);
    answer({ education: latest ? educationFromEntry(latest) : emptyEducation() });
  }, [education, profile.data, answer]);

  const loading = education === undefined && profile.isPending;
  const current = education ?? emptyEducation();
  const set = (patch: Partial<EducationAnswer>) => answer({ education: { ...current, ...patch } });

  const onContinue = () => {
    if (!educationBlank(current)) {
      const existing = profile.data?.education.find((e) => e.id === current.id);
      if (educationChanged(current, existing)) {
        upsert.mutate(entryFromEducation(current, existing), {
          onError: () =>
            showToast('We couldn’t save your education. You can add it later on your profile.', {
              tone: 'error',
            }),
        });
      }
    }
    router.push(NEXT);
  };

  return (
    <QuestionLayout
      eyebrow="Let’s build your starting point"
      title="Where did you study?"
      help="Optional. Your highest qualification is enough."
      onContinue={onContinue}
      canContinue={educationBlank(current) || educationComplete(current)}
      continueLabel="Create my starting point"
      back="/onboarding/skills"
    >
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[66px] rounded-lg" />
          <Skeleton className="h-[66px] rounded-lg" />
          <Skeleton className="h-[66px] w-44 rounded-lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <OnboardingField
            label="Degree"
            showLabel
            value={current.degree}
            onChange={(degree) => set({ degree })}
            Icon={SchoolIcon}
            placeholder="e.g. B.Des, Interaction Design"
            clearable={false}
          />
          <OnboardingField
            label="School or university"
            showLabel
            value={current.school}
            onChange={(school) => set({ school })}
            Icon={ApartmentIcon}
            placeholder="e.g. NID Ahmedabad"
            autoComplete="organization"
            clearable={false}
          />
          <YearField
            label="Year finished"
            value={current.year}
            onChange={(year) => set({ year })}
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => router.push(NEXT)}
        className={cn(
          pressable,
          'mt-4 flex items-center gap-1.5 rounded-sm text-body-l font-semibold text-text-brand',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        )}
      >
        Skip this question
        <ChevronRightIcon aria-hidden className="size-3.5" />
      </button>
    </QuestionLayout>
  );
}
