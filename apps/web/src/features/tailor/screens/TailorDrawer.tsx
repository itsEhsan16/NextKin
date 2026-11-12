'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';

import { Drawer } from '@/ui/Drawer';

import type { TailorTargetRef } from '../tailorTarget';
import { TailorRoute } from './TailorRoute';
import { TailorScreen } from './TailorScreen';

/**
 * Tailoring over the job it is for (redesign R5d; owner, 2026-11-12; Jobright §2.3 adopted): the
 * same `/…/tailor` URL, opened from the job's (or JD's) own page, draws as a drawer over that page
 * instead of leaving it. Deep links and a refresh still open the full page; below 1280 the drawer
 * fills the window. Closing it goes back to the page underneath.
 */
export function TailorDrawer({ target }: { target: TailorTargetRef }) {
  const router = useRouter();
  const home = (
    target.kind === 'jd'
      ? `/jd/${encodeURIComponent(target.id)}`
      : `/jobs/${encodeURIComponent(target.id)}`
  ) as Route;
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) router.push(home, { scroll: false });
      }}
      title="Tailor your resume"
    >
      <Suspense fallback={<TailorScreen target={target} />}>
        <TailorRoute target={target} />
      </Suspense>
    </Drawer>
  );
}
