'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useEffect } from 'react';

import { cn } from '@/lib/cn';

import { useOnboardingStore } from '../onboardingStore';
import { OnboardingLogoIllustration } from '@/ui/illustrations';
import { ProgressBar } from '@/ui/ProgressBar';
import { pressable } from '@/ui/pressable';

import { artLayout, FLOW_PROGRESS, ONBOARDING_EXIT, pageFor, progressOf } from '../onboardingSteps';
import { useProfileSoFar } from '../useProfileSoFar';
import { ProfileSoFar } from './ProfileSoFar';

/**
 * What stays put while the questions change (807:3 and its siblings): the logo, "Step x of 4"
 * with its bar and "Skip for now", and the right-hand column of art over "Your profile so far".
 * A layout, so the bar eases from one step to the next and the card keeps its answers; only the
 * question column and the art change.
 *
 * Sized to the compact ramp, not the board's 1536 frame (`toreview.md` §16): the board's
 * proportions, at one laptop window's density. The art column steps aside below `lg`.
 */
export function OnboardingFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const page = pageFor(pathname);
  const { art, aspect, left, top, size } = artLayout(page);
  const rows = useProfileSoFar(page);
  const progress = FLOW_PROGRESS[page.flow];
  // The answers kept for this tab come back after the first paint (OB-05).
  useEffect(() => {
    void useOnboardingStore.persist.rehydrate();
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-0">
      <header className="mx-auto flex w-full max-w-flow flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 pt-5 sm:px-6 lg:px-10">
        <div className="flex items-center gap-2.5">
          <OnboardingLogoIllustration className="h-[29px] w-7" />
          <span className="text-h1 font-bold text-text-primary">NextKin</span>
        </div>
        {/* Below 640: the logo and Skip share the top row, the count and bar take the next (OB-02).
            From 640 they sit together at the right. */}
        {(page.flow === 'build' || (page.flow === 'questions' && page.step > 1)) && (
          <Link
            href={ONBOARDING_EXIT}
            className={cn(
              pressable,
              'flex h-control-sm items-center whitespace-nowrap rounded-sm px-1.5 text-body-m font-semibold text-text-tertiary hover:text-text-primary sm:order-last',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            )}
          >
            Skip for now
          </Link>
        )}
        <div className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
          <span className="text-body-s font-semibold text-text-secondary sm:text-body-m">
            {progress.label(page.step)}
          </span>
          <ProgressBar
            value={progressOf(page)}
            label="Onboarding progress"
            className="w-24 shrink-0 bg-neutral-100 sm:w-44"
          />
        </div>
      </header>

      <main
        id="main"
        className="mx-auto grid w-full max-w-flow gap-x-16 px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:grid-cols-[minmax(0,540px)_380px] lg:justify-between"
      >
        <div className="min-w-0">{children}</div>
        <aside className="hidden flex-col gap-1 lg:flex">
          {page.flow === 'done' ? (
            // ONB 08 (821:384): the drawing on its own, as wide as the column.
            <Image
              key={page.key}
              loading="eager"
              src={art.src}
              alt=""
              width={art.width}
              height={art.height}
              className="h-auto w-full animate-reveal"
            />
          ) : (
            <>
              <div className="relative" style={{ aspectRatio: aspect }}>
                <Image
                  key={page.key}
                  loading="eager"
                  src={art.src}
                  alt=""
                  width={art.width}
                  height={art.height}
                  className="absolute h-auto max-w-none animate-reveal"
                  style={{
                    left: `${left * 100}%`,
                    top: `${top * 100}%`,
                    width: `${size * 100}%`,
                  }}
                />
              </div>
              <ProfileSoFar rows={rows} />
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
