'use client';

import { useCurrentUser, useUpdateName } from '@nextkin/shared/queries';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { showToast } from '@/lib/toast';
import { PersonIcon } from '@/ui/icons';
import { Skeleton } from '@/ui/Skeleton';

import { OnboardingField } from '../components/OnboardingField';
import { QuestionLayout } from '../components/QuestionLayout';
import { useOnboardingStore } from '../onboardingStore';

/** "George Smith" → George / Smith; a single word is a first name with no last name. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = full.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

/**
 * ONB 01 · What's your name? (807:3). Starts from the account's own name, so a user who signed up
 * with one only has to confirm it. Continue saves it to the account, as Settings' name field does.
 */
export function NameStepScreen() {
  const router = useRouter();
  const user = useCurrentUser();
  const updateName = useUpdateName();
  const name = useOnboardingStore((state) => state.name);
  const answer = useOnboardingStore((state) => state.answer);

  useEffect(() => {
    if (name === undefined && user.data) {
      answer({ name: `${user.data.firstName} ${user.data.lastName}`.trim() });
    }
  }, [name, user.data, answer]);

  const value = name ?? '';
  const loading = name === undefined && user.isPending;

  const onContinue = () => {
    const next = splitName(value);
    if (next.firstName !== user.data?.firstName || next.lastName !== user.data?.lastName) {
      updateName.mutate(next, {
        onError: () =>
          showToast('We couldn’t save your name. You can change it later in Settings.', {
            tone: 'error',
          }),
      });
    }
    router.push('/onboarding/goal');
  };

  return (
    <QuestionLayout
      eyebrow="Welcome to NextKin"
      title={
        <>
          First, what should
          <br />
          we call you?
        </>
      }
      help={
        <>
          We’ll use it on your resume and to say hello.
          <br />
          You can change it later.
        </>
      }
      onContinue={onContinue}
      canContinue={value.trim().length > 0}
    >
      <OnboardingField
        label="Your name"
        value={value}
        onChange={(next) => answer({ name: next })}
        Icon={PersonIcon}
        placeholder="Your full name"
        autoComplete="name"
        autoFocus
        emphasis
        loading={loading ? <Skeleton className="h-12 rounded-lg" /> : undefined}
      />
    </QuestionLayout>
  );
}
