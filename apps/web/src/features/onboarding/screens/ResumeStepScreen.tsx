'use client';

import { useGuardedRouter } from '@/navigation/guardedRouter';
import { ChoiceCard } from '../components/ChoiceCard';
import { QuestionLayout } from '../components/QuestionLayout';
import { RESUME_CHOICES } from '../onboardingOptions';
import { useOnboardingStore } from '../onboardingStore';

/**
 * ONB 04 · Do you have a resume? (807:215). "Yes" goes on to ONB 04b, the upload; "No" to the
 * three quick questions, starting with ONB 05, your recent work.
 */
export function ResumeStepScreen() {
  const router = useGuardedRouter();
  const { resume, answer } = useOnboardingStore();

  return (
    <QuestionLayout
      eyebrow="Question 4"
      title={
        <>
          Do you already have
          <br />a resume?
        </>
      }
      help="Either way works. We’ll use it to fill your profile — nothing is made up."
      onContinue={() =>
        router.push(resume === 'upload' ? '/onboarding/upload' : '/onboarding/work')
      }
      canContinue={resume !== undefined}
      back="/onboarding/experience"
    >
      <div role="radiogroup" aria-label="Do you have a resume?" className="flex gap-3">
        {RESUME_CHOICES.map((choice) => (
          <ChoiceCard
            key={choice.value}
            name="resume"
            value={choice.value}
            checked={resume === choice.value}
            onSelect={() => answer({ resume: choice.value })}
            label={choice.label}
            hint={choice.hint}
            Art={choice.Art}
          />
        ))}
      </div>
    </QuestionLayout>
  );
}
