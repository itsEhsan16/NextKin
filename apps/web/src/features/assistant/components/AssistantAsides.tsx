import type { SubscriptionPlan } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { ProgressBar } from '@/ui/ProgressBar';
import { ProfilePaperPlaneIllustration, SettingsPrivacyIllustration } from '@/ui/illustrations';

/**
 * Daily messages (768:158): today's count against the plan's cap, the bar, what is left and the
 * way to more. §7.16 and §13.5 want the cap on screen before it is hit.
 */
export function DailyMessagesCard({
  used,
  limit,
  plan,
  sweep = false,
}: {
  used: number;
  limit: number;
  plan: SubscriptionPlan;
  /** Fill the bar from empty: it arrived with its data rather than from the cache. */
  sweep?: boolean;
}) {
  if (limit <= 0) return null;
  const left = Math.max(0, limit - used);
  const on = plan === 'pro' ? 'Pro' : 'Free';
  return (
    <section
      aria-labelledby="daily-messages"
      className={cn(cardSurface, 'flex flex-col gap-3 p-5')}
    >
      <div className="flex items-center gap-2.5">
        <ProfilePaperPlaneIllustration aria-hidden className="h-auto w-[26px] shrink-0" />
        <h2 id="daily-messages" className="flex-1 text-title-l text-text-primary">
          Daily messages
        </h2>
        <span className="text-body-l font-bold tabular-nums text-text-primary">
          {used} / {limit}
        </span>
      </div>
      <ProgressBar
        value={used / limit}
        label={`${used} of ${limit} messages used today`}
        className="h-1.5 bg-neutral-100"
        sweep={sweep}
      />
      <div className="flex items-center text-body-s">
        <span className="flex-1 font-medium text-text-tertiary">
          {left === 0 ? `None left today on ${on}` : `${left} left today on ${on}`}
        </span>
        {plan === 'free' && (
          <Link
            href={'/settings?tab=billing' as Route}
            className="rounded-sm font-semibold text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            See Pro plans
          </Link>
        )}
      </div>
    </section>
  );
}

/** "Read and advise only" (768:174): what the assistant will never do, on a lavender note. */
export function ReadOnlyNote() {
  return (
    <aside className="flex items-center gap-3 rounded-lg bg-surface-brand px-5 py-4">
      <SettingsPrivacyIllustration aria-hidden className="h-auto w-[30px] shrink-0" />
      <div className="min-w-0">
        <p className="text-body-m font-semibold text-text-primary">Read and advise only</p>
        <p className="text-body-s font-medium text-text-tertiary">
          It never edits, sends or deletes anything.
        </p>
      </div>
    </aside>
  );
}
