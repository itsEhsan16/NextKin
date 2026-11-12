import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Card } from '@/ui/Card';
import { AiSparkIcon } from '@/ui/icons';
import { buttonClass } from '@/ui/Button';

/**
 * "Improve your chances with AI" (286:640), at the compact density.
 *
 * The board centres a text column against the robot, which sits flush to the card's bottom-right
 * — anchored to the bottom here, so it stays flush whatever height the row settles at. The
 * button is the two-tone treatment in `primaryButton`, with the three-star cluster the board
 * draws inside it.
 */
export function AiPromoCard() {
  return (
    <Card
      tone="brand"
      className="relative flex min-h-[200px] flex-1 flex-col justify-center overflow-hidden p-6"
    >
      <div className="relative max-w-[320px]">
        <h2 className="text-h2 text-text-primary">Improve your chances with AI</h2>
        <p className="mt-2 text-body-m text-text-secondary">
          Get AI-powered suggestions to enhance your resume, prepare for interviews, and land more
          offers.
        </p>
        <Link
          href="/assistant"
          // One filled button per view (HM-09): the top bar's Upload New JD is the filled one.
          className={cn(
            buttonClass({ variant: 'brand-secondary', size: 'md', pill: true }),
            'mt-5 pl-4 pr-5',
          )}
        >
          <AiSparkIcon className="h-[18px] w-[17px]" />
          Ask AI Assistant
        </Link>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG art, no optimisation to do */}
      <img
        src="/illustrations/v2/ai-assistant.webp"
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-3 right-6 h-[150px] w-auto object-contain max-lg:hidden"
      />
    </Card>
  );
}
