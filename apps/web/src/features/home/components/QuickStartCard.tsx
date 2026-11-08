import Link from 'next/link';
import type { Route } from 'next';
import type { ComponentType, SVGProps } from 'react';

import { Card } from '@/ui/Card';
import { SectionHeader } from '@/ui/SectionHeader';
import {
  AtsCheckIllustration,
  BuildResumeIllustration,
  CoverLetterIllustration,
  TailorToAJobIllustration,
  ZeroResumeIllustration,
} from '@/ui/illustrations';

type Tile = {
  key: string;
  label: string;
  hint: string;
  href: Route;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Five entry points (286:216). Mobile's Quick Start has four — the web board adds "Tailor to a
 * Job" and renames the hints, so the copy here is the web board's, not mobile's. Each opens its
 * own flow (toreview §125): Build makes a new resume for a job from the profile, Tailor reworks
 * one you have; Zero Resume, Cover Letter and ATS Check are mobile's flows on the web.
 */
const TILES: readonly Tile[] = [
  {
    key: 'build-resume',
    label: 'Build Resume',
    hint: 'For a specific job',
    // Job first, then the resume, the comparison and what to improve (toreview §126).
    href: '/create/build' as Route,
    Art: BuildResumeIllustration,
  },
  {
    key: 'zero-resume',
    label: 'Zero Resume',
    hint: 'Build from scratch',
    href: '/create/zero-resume' as Route,
    Art: ZeroResumeIllustration,
  },
  {
    key: 'tailor',
    label: 'Tailor to a Job',
    hint: 'Tailored to JD',
    href: '/create/tailor' as Route,
    Art: TailorToAJobIllustration,
  },
  {
    key: 'cover-letter',
    label: 'Cover Letter',
    hint: 'Personalized letter',
    href: '/create/cover-letter' as Route,
    Art: CoverLetterIllustration,
  },
  {
    key: 'ats-check',
    label: 'ATS Check',
    hint: 'Check your score',
    // A resume against one job, mobile's ATS 01–03 (toreview §125).
    href: '/create/ats-check' as Route,
    Art: AtsCheckIllustration,
  },
];

/**
 * Quick Start, at the compact density: 120px tiles with the board's art at ~72%. Its title goes
 * through `SectionHeader` like every other Home section, rather than the 20px H2 it had alone.
 */
export function QuickStartCard() {
  return (
    <Card className="flex-1 p-6">
      <SectionHeader title="Quick Start" />
      <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {TILES.map(({ key, label, hint, href, Art }) => (
          <li key={key}>
            <Link
              href={href}
              className="flex h-[140px] flex-col items-center justify-end rounded-lg bg-neutral-50 px-2 pb-4 transition-[background-color,box-shadow,translate,scale] duration-base ease-standard hover:-translate-y-0.5 hover:bg-surface-card hover:shadow-card-hover active:scale-(--scale-pressed) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Art className="mb-auto mt-4 h-[56px] w-[52px]" />
              <span className="text-body-m font-semibold text-text-primary">{label}</span>
              <span className="mt-1 text-caption-m text-text-tertiary">{hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
