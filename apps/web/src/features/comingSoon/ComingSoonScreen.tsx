import { PRO_SUMMARY } from '@/features/settings/billingLibrary';
import type { Route } from 'next';
import Image from 'next/image';

import { ComingSoon, type ComingSoonProps } from '@/ui/ComingSoon';
import { LogoMarkIllustration } from '@/ui/illustrations';

/** The destinations the app links to that this milestone doesn't build yet. */
export type ComingSoonPage = 'interview' | 'upgrade';

/**
 * Each placeholder's copy in one place (`toreview.md` §85): what the page will do, said in the
 * reader's terms; the nearest page that works today; and the V2 section it implements, in small
 * print. The art is the closest existing drawing for the area, not new work.
 */
const PAGES: Record<ComingSoonPage, ComingSoonProps> = {
  interview: {
    title: 'Interview Prep',
    section: 'V2 §7.15, interview question generation and practice mode',
    description:
      'Practice questions written for one job and your resume, so you walk in knowing what they will ask.',
    art: (
      <Image
        src="/illustrations/v2/interview-soon.webp"
        alt=""
        width={431}
        height={560}
        className="h-55 w-auto object-contain"
      />
    ),
    alternative: { label: 'See your applications', href: '/applications' as Route },
  },
  upgrade: {
    title: 'Upgrade to Pro',
    section: 'V2 §13, plans, entitlements and billing',
    description: PRO_SUMMARY,
    art: <LogoMarkIllustration className="h-16 w-auto" />,
    // The plans, the card on file and the invoices are Settings → Billing & plan (`toreview.md` §102).
    alternative: { label: 'See your plan and billing', href: '/settings?tab=billing' as Route },
  },
};

/** The placeholder for one not-yet-built destination. */
export function ComingSoonScreen({ page }: { page: ComingSoonPage }) {
  return <ComingSoon {...PAGES[page]} />;
}
