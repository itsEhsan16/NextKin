import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Card } from '@/ui/Card';
import { AiSparkIcon } from '@/ui/icons';
import { primaryButton } from '@/ui/primaryButton';

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
      className="relative flex min-h-[190px] flex-1 flex-col justify-center overflow-hidden p-4"
    >
      <div className="relative max-w-[320px]">
        <h2 className="text-h2 text-text-primary">Improve your chances with AI</h2>
        <p className="mt-2 text-body-m text-text-tertiary">
          Get AI-powered suggestions to enhance your resume, prepare for interviews, and land more
          offers.
        </p>
        <Link
          href="/assistant"
          className={cn(primaryButton, 'mt-4 h-control-md gap-2 pl-3 pr-5 text-body-m')}
        >
          <AiSparkIcon className="h-[18px] w-[17px]" />
          Ask AI Assistant
        </Link>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG art, no optimisation to do */}
      <img
        src="/illustrations/ai-assistant.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-3 h-[169px] w-[243px] max-lg:hidden"
      />
    </Card>
  );
}
