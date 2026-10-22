'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { tailorPath, type TailorTargetRef } from './tailorTarget';

/**
 * "Tailor your resume" on a job's own page. Since the one Customize screen (toreview §114, owner
 * 2026-10-19) it goes straight there, with the base resume picked; "Which resume should we
 * tailor?" opens only from that screen's "Change". The shape stays, so the pages need no change.
 */
export function useTailorDialog(target: TailorTargetRef): {
  openDialog: () => void;
  dialog: ReactNode;
} {
  const router = useRouter();
  return { openDialog: () => router.push(tailorPath(target)), dialog: null };
}
