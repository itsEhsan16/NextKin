'use client';

import { MAX_DESIRED_ROLES, type ProfilePreferences } from '@nextkin/shared/models';
import { useProfile, useUpdatePreferences } from '@nextkin/shared/queries';
import { useEffect } from 'react';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { showToast } from '@/lib/toast';
import { BriefcaseIcon } from '@/ui/icons';

import { OnboardingField } from '../components/OnboardingField';
import { OptionCard } from '../components/OptionCard';
import { QuestionLayout } from '../components/QuestionLayout';
import { GOALS } from '../onboardingOptions';
import { useOnboardingStore } from '../onboardingStore';

/**
 * ONB 02 · Your goal (807:53). Starts from a goal saved before, if any. Continue saves the goal
 * to the profile's preferences, and puts the role typed under it first in the desired roles,
 * which is what the job matcher reads.
 */
export function GoalStepScreen() {
  const router = useGuardedRouter();
  const profile = useProfile();
  const updatePreferences = useUpdatePreferences();
  const { name, goal, targetRole = '', answer } = useOnboardingStore();
  const firstName = name?.trim().split(/\s+/)[0];
  const saved = profile.data?.preferences.careerGoal;

  useEffect(() => {
    if (goal === undefined && saved) answer({ goal: saved });
  }, [goal, saved, answer]);

  const onContinue = () => {
    const patch: Partial<ProfilePreferences> = {};
    if (goal && goal !== saved) patch.careerGoal = goal;
    const role = targetRole.trim();
    const roles = profile.data?.preferences.desiredRoles;
    if (role && roles && roles[0] !== role) {
      patch.desiredRoles = [role, ...roles.filter((r) => r !== role)].slice(0, MAX_DESIRED_ROLES);
    }
    if (Object.keys(patch).length > 0) {
      updatePreferences.mutate(patch, {
        onError: () =>
          showToast('We couldn’t save your goal. You can change it later in Settings.', {
            tone: 'error',
          }),
      });
    }
    router.push('/onboarding/experience');
  };

  return (
    <QuestionLayout
      eyebrow="Your goal"
      title={firstName ? `Nice to meet you, ${firstName}!` : 'Nice to meet you!'}
      subtitle="What are you aiming for?"
      help="Pick the one that fits best."
      onContinue={onContinue}
      canContinue={goal !== undefined}
      back="/onboarding"
    >
      <div role="radiogroup" aria-label="Your goal" className="flex flex-col gap-2">
        {GOALS.map((option) => (
          <OptionCard
            key={option.value}
            name="goal"
            value={option.value}
            checked={goal === option.value}
            onSelect={() => answer({ goal: option.value })}
            label={option.label}
            hint={option.hint}
            Art={option.Art}
          />
        ))}
      </div>
      <div className="mt-4">
        <OnboardingField
          label="The role you want"
          showLabel
          value={targetRole}
          onChange={(next) => answer({ targetRole: next })}
          Icon={BriefcaseIcon}
          placeholder="e.g. Lead UX Designer"
          autoComplete="organization-title"
        />
      </div>
    </QuestionLayout>
  );
}
