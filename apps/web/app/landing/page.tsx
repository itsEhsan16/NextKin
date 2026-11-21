import type { Metadata } from 'next';

import { LandingScreen } from '@/features/landing/LandingScreen';

export const metadata: Metadata = {
  title: 'NextKin · Every resume, written honestly for the job you want',
  description:
    'Paste a job and NextKin rewrites your resume to match it, then shows you why, line by line. It never adds a skill you don’t have. Free to start.',
};

/**
 * nextkin.ai's first page. On the landing host the proxy rewrites `/` here
 * (src/lib/landingHost.ts); elsewhere it is reachable at /landing.
 */
export default function LandingPage() {
  return <LandingScreen />;
}
