import type { CareerInsights } from '@nextkin/shared/models';
import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { brandButton } from '@/ui/brandButton';
import { ArrowRightIcon } from '@/ui/icons';
import { InsightsStarIllustration } from '@/ui/illustrations';

import { insightPanel } from './InsightsCards';

/**
 * "Next Recommendation" (463:48): the role the account fits best, why, and the way to those jobs,
 * on the brand tint with the board's character at the foot.
 */
export function RecommendationCard({
  recommendation,
}: {
  recommendation: CareerInsights['recommendation'];
}) {
  return (
    <section
      aria-labelledby="insights-next"
      className={cn(
        insightPanel,
        'relative flex flex-col overflow-hidden border-border-brand bg-surface-brand',
      )}
    >
      <div className="flex items-center gap-2.5">
        <InsightsStarIllustration aria-hidden className="h-auto w-[37px] shrink-0" />
        <h2 id="insights-next" className="text-body-m font-semibold text-text-secondary">
          Next Recommendation
        </h2>
      </div>
      <p className="mt-4 max-w-[290px] text-display-l text-text-primary">
        {/* A verdict with its reason under it, not praise (redesign R7a, audit IN-01). */}
        {recommendation.role} roles match your profile best
      </p>
      <p className="mt-3 max-w-[270px] text-body-m text-text-secondary">{recommendation.reason}</p>
      <Link
        href="/jobs"
        className={cn(
          brandButton,
          'relative z-raised mt-auto h-control-lg w-fit gap-2 rounded-md px-5 text-body-m font-semibold',
        )}
      >
        View Matched Jobs
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
      {/* A raster on the board (463:67). */}
      <Image
        src="/illustrations/v2/recommendation.webp"
        alt=""
        width={560}
        height={541}
        className="pointer-events-none absolute bottom-2.5 right-1.5 h-[93px] w-[190px] object-contain"
      />
    </section>
  );
}
