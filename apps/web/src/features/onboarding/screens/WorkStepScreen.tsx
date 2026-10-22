'use client';

import { useProfile, useUpsertExperience } from '@nextkin/shared/queries';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { Checkbox } from '@/ui/Checkbox';
import { PlusIcon } from '@/ui/icons';
import { pressable } from '@/ui/pressable';
import { Skeleton } from '@/ui/Skeleton';

import { QuestionLayout } from '../components/QuestionLayout';
import { RoleFields } from '../components/RoleFields';
import { useOnboardingStore, type RoleAnswer } from '../onboardingStore';
import {
  emptyRole,
  experienceFromRole,
  mostRecent,
  roleChanged,
  roleComplete,
  roleFromExperience,
} from '../roles';

/**
 * ONB 05 · Your recent work (808:88), the first of the quick questions after "No, help me make
 * one". Starts from the profile's most recent role, if it has one. Continue saves each role to the
 * profile's timeline, as the profile's own editor does, and goes on to the skills. "I haven't
 * worked yet" skips the roles without saving anything.
 */
export function WorkStepScreen() {
  const router = useRouter();
  const profile = useProfile();
  const upsert = useUpsertExperience();
  const { roles, noWork = false, answer } = useOnboardingStore();

  useEffect(() => {
    if (roles !== undefined || !profile.data) return;
    const recent = mostRecent(profile.data.experiences);
    answer({ roles: [recent ? roleFromExperience(recent) : emptyRole()] });
  }, [roles, profile.data, answer]);

  const list = roles ?? [];
  const loading = roles === undefined && profile.isPending;
  const setRole = (index: number, patch: Partial<RoleAnswer>) =>
    answer({ roles: list.map((role, i) => (i === index ? { ...role, ...patch } : role)) });

  const onContinue = () => {
    if (!noWork) {
      const existing = profile.data?.experiences ?? [];
      for (const role of list) {
        const entry = experienceFromRole(role);
        if (
          !entry ||
          !roleChanged(
            role,
            existing.find((e) => e.id === role.id),
          )
        )
          continue;
        upsert.mutate(entry, {
          onError: () =>
            showToast('We couldn’t save a role. You can add it later on your profile.', {
              tone: 'error',
            }),
        });
      }
    }
    router.push('/onboarding/skills');
  };

  return (
    <QuestionLayout
      eyebrow="Let’s build your starting point"
      title={
        <>
          What’s your most
          <br />
          recent job?
        </>
      }
      help="Just the basics. You can add more roles later."
      onContinue={onContinue}
      canContinue={noWork || (list.length > 0 && list.every(roleComplete))}
      back="/onboarding/resume"
    >
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[66px] rounded-lg" />
          <Skeleton className="h-[66px] rounded-lg" />
          <Skeleton className="h-[66px] rounded-lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((role, index) => (
            <RoleFields
              key={role.id}
              role={role}
              index={index}
              disabled={noWork}
              onChange={(patch) => setRole(index, patch)}
              onRemove={
                index > 0 ? () => answer({ roles: list.filter((_, i) => i !== index) }) : undefined
              }
            />
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-col items-start gap-3">
        <Checkbox
          label="I haven’t worked yet — skip this"
          checked={noWork}
          onChange={(checked) => answer({ noWork: checked })}
        />
        <button
          type="button"
          disabled={noWork || loading}
          onClick={() => answer({ roles: [...list, emptyRole()] })}
          className={cn(
            pressable,
            'flex items-center gap-2 rounded-sm text-body-l font-semibold text-text-brand disabled:opacity-50',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          )}
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-text-inverse">
            <PlusIcon aria-hidden className="size-3" />
          </span>
          Add another role
        </button>
      </div>
    </QuestionLayout>
  );
}
