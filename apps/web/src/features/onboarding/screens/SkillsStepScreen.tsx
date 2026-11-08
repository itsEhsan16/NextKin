'use client';

import { skillSuggestionsForTitle } from '@nextkin/shared/models';
import { useProfile, useUpdateSkills } from '@nextkin/shared/queries';
import { useEffect, useState, type KeyboardEvent } from 'react';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { PlusIcon, TickIcon } from '@/ui/icons';
import { pressable } from '@/ui/pressable';
import { Skeleton } from '@/ui/Skeleton';

import { OnboardingField } from '../components/OnboardingField';
import { QuestionLayout } from '../components/QuestionLayout';
import { useOnboardingStore } from '../onboardingStore';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const has = (list: readonly string[], skill: string) => list.some((s) => same(s, skill));

/**
 * ONB 06 · Your skills (808:175). Capsules suggested from the job title just given (or the
 * profile's headline), with the profile's own skills already picked, and a field to add any the
 * suggestions miss. Nothing is picked for the user that they had not already said. Continue saves
 * the picked set as the profile's skills and goes on to ONB 07, education.
 */
export function SkillsStepScreen() {
  const router = useGuardedRouter();
  const profile = useProfile();
  const updateSkills = useUpdateSkills();
  const { roles, noWork, jobTitle, skills, answer } = useOnboardingStore();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (skills === undefined && profile.data) answer({ skills: profile.data.skills });
  }, [skills, profile.data, answer]);

  const title = (!noWork && roles?.[0]?.title) || jobTitle || profile.data?.headline;
  const picked = skills ?? [];
  // The suggestions first, in their order, then anything picked that they don't include.
  const suggestions = skillSuggestionsForTitle(title);
  const capsules = [...suggestions, ...picked.filter((skill) => !has(suggestions, skill))];
  const loading = skills === undefined && profile.isPending;

  const toggle = (skill: string) =>
    answer({
      skills: has(picked, skill) ? picked.filter((s) => !same(s, skill)) : [...picked, skill],
    });

  const addOwn = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !draft.trim()) return;
    // Enter in this field adds the skill; on an empty field it continues, as everywhere else.
    event.preventDefault();
    const skill = draft.trim();
    if (!has(picked, skill)) answer({ skills: [...picked, skill] });
    setDraft('');
  };

  const onContinue = () => {
    const before = profile.data?.skills ?? [];
    const changed = before.length !== picked.length || picked.some((skill) => !has(before, skill));
    if (changed) {
      updateSkills.mutate(picked, {
        onError: () =>
          showToast('We couldn’t save your skills. You can add them later on your profile.', {
            tone: 'error',
          }),
      });
    }
    router.push('/onboarding/education');
  };

  return (
    <QuestionLayout
      eyebrow="Let’s build your starting point"
      title="What are you good at?"
      help="Pick the skills you really use. Suggestions come from your job title."
      onContinue={onContinue}
      canContinue={picked.length > 0}
      back="/onboarding/work"
    >
      {loading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      ) : (
        <ul aria-label="Skills" className="flex flex-wrap gap-2">
          {capsules.map((skill) => {
            const on = has(picked, skill);
            return (
              <li key={skill}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(skill)}
                  className={cn(
                    pressable,
                    'flex h-8 items-center gap-1.5 rounded-full border pl-3 pr-2.5 text-body-m',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                    on
                      ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700'
                      : 'border-border-default bg-surface-card font-medium text-neutral-700 hover:bg-neutral-50',
                  )}
                >
                  {skill}
                  {on ? (
                    <TickIcon aria-hidden className="size-3.5 text-brand-600" />
                  ) : (
                    <PlusIcon aria-hidden className="size-3 text-neutral-400" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-5">
        <OnboardingField
          label="Add your own"
          showLabel
          value={draft}
          onChange={setDraft}
          onKeyDown={addOwn}
          Icon={PlusIcon}
          placeholder="Type a skill and press Enter"
          clearable={false}
        />
      </div>
    </QuestionLayout>
  );
}
