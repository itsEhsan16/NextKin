import Link from 'next/link';
import type { Route } from 'next';

import { cn } from '@/lib/cn';

import { useOnboardingStore } from '../onboardingStore';
import { ArrowRightIcon, TickIcon } from '@/ui/icons';

type Step = { label: string; done?: boolean; href?: Route };

/**
 * ONB 08's next steps (816:211), the §7.2 guided checklist: the profile, done; adding a job,
 * which opens Build Resume's job step; then the first tailored resume, which needs that job first.
 */
const steps = (profileDone: boolean): readonly Step[] => [
  // After an upload the profile isn't filled yet: it waits on a review (OB-25).
  { label: 'Your profile', done: profileDone },
  { label: 'Add a job you want — paste a link or a description', href: '/create/build' },
  { label: 'Generate your first tailored resume' },
];

export function NextSteps() {
  const uploaded = useOnboardingStore((state) => state.resume === 'upload');
  const STEPS = steps(!uploaded);
  return (
    <section aria-labelledby="next-steps" className="flex flex-col">
      <h2 id="next-steps" className="text-title-l font-bold text-text-primary">
        Next steps
      </h2>
      <ol className="mt-2.5 flex flex-col">
        {STEPS.map((step, index) => {
          const last = index === STEPS.length - 1;
          return (
            <li key={step.label} className="flex gap-3">
              <span className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-caption-m font-bold',
                    step.done
                      ? 'bg-brand-600 text-text-inverse'
                      : 'border-[1.5px] border-neutral-400 bg-surface-card text-text-secondary',
                  )}
                >
                  {step.done ? (
                    <TickIcon
                      aria-hidden={false}
                      role="img"
                      aria-label="Done"
                      className="size-3.5"
                    />
                  ) : (
                    index + 1
                  )}
                </span>
                {!last && <span aria-hidden className="h-3 w-0.5 bg-border-default" />}
              </span>
              <span className="pt-0.5">
                {step.href ? (
                  <Link
                    href={step.href}
                    className="group flex items-center gap-1.5 rounded-sm text-body-l font-semibold text-text-primary hover:text-text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    {step.label}
                    <ArrowRightIcon
                      aria-hidden
                      className="size-3.5 text-text-tertiary transition-[translate,color] duration-press ease-standard group-hover:translate-x-0.5 group-hover:text-text-brand"
                    />
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'text-body-l',
                      step.done
                        ? 'font-medium text-text-tertiary'
                        : 'font-semibold text-text-primary',
                    )}
                  >
                    {step.label}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
