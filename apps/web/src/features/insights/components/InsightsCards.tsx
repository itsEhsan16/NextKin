import type { CareerInsights, InsightsShare, InsightsStat } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { NavAiAssistantIllustration } from '@/ui/illustrations';

import { INSIGHT_ART } from '../insightsLibrary';
import { cardPad, cardSurface } from '@/ui/Card';
import { ProgressBar } from '@/ui/ProgressBar';

/** An Insights card with the one padding every card takes (toreview §132). */
export const insightPanel = cn(cardSurface, cardPad);

/** A card's heading and the line under it (462:3, 462:4). */
export function CardHead({
  id,
  title,
  subtitle,
  aside,
}: {
  id: string;
  title: string;
  subtitle: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-title-l text-text-primary">
          {title}
        </h2>
        <p className="mt-1 text-body-s text-text-tertiary">{subtitle}</p>
      </div>
      {aside}
    </div>
  );
}

/** A card head's way onward, styled as Home's "View all" (`SectionHeader`). */
export function CardLink({ href, children }: { href: Route; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-sm text-body-s font-semibold text-text-brand transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      {children}
    </Link>
  );
}

/** The green change pill (461:108); a fall reads in red, no change in grey. */
function Change({ pct }: { pct: number }) {
  const tone =
    pct > 0
      ? 'bg-success-surface text-success-text'
      : pct < 0
        ? 'bg-danger-50 text-danger-text'
        : 'bg-surface-muted text-text-tertiary';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption-m font-semibold',
        tone,
      )}
    >
      <span aria-hidden>{pct > 0 ? '↑' : pct < 0 ? '↓' : '→'}</span>
      <span className="sr-only">{pct >= 0 ? 'up' : 'down'}</span>
      {Math.abs(pct)}%
    </span>
  );
}

/** One of the four stats (461:88): the board's art, the name, the figure and its change. */
export function StatCard({
  Art,
  label,
  stat,
  outOf,
  footnote,
}: {
  Art: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  stat: InsightsStat;
  outOf?: number;
  footnote: string;
}) {
  return (
    <section aria-label={label} className={cn(insightPanel, 'flex items-center gap-4')}>
      <Art aria-hidden className="h-auto w-13 shrink-0" />
      <div className="min-w-0">
        <p className="text-body-m font-medium text-text-secondary">{label}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-display-l text-text-primary">
            {stat.value}
            {outOf != null && (
              <span className="ml-1 text-title-l font-medium text-neutral-400">/ {outOf}</span>
            )}
          </span>
          <Change pct={stat.changePct} />
        </p>
        <p className="mt-0.5 text-body-s font-medium text-text-tertiary">{footnote}</p>
      </div>
    </section>
  );
}

/** A labelled bar out of 100: the funnel's stages and the skill and role shares. */
function Bar({ pct, label, strong }: { pct: number; label: string; strong?: boolean }) {
  return (
    <ProgressBar
      value={pct / 100}
      label={label}
      sweep
      className="h-3 flex-1 rounded-sm bg-brand-50"
      fillClassName={cn('rounded-sm', strong ? 'bg-brand-600' : 'bg-border-selected')}
    />
  );
}

/** "Application Funnel" (462:29): each stage's count and its share of the applications. */
export function FunnelCard({ funnel }: { funnel: CareerInsights['funnel'] }) {
  const base = Math.max(funnel.applications, 1);
  const stages: [string, number][] = [
    ['Applications', funnel.applications],
    ['Shortlisted', funnel.shortlisted],
    ['Interviews', funnel.interviews],
    ['Offers', funnel.offers],
  ];
  return (
    <section aria-labelledby="insights-funnel" className={insightPanel}>
      <CardHead
        id="insights-funnel"
        title="Application Funnel"
        subtitle="From application to offer."
      />
      <dl className="mt-8 flex flex-col gap-[30px]">
        {stages.map(([stage, count]) => {
          const pct = Math.round((count / base) * 100);
          return (
            <div key={stage} className="flex items-center gap-2">
              <dt className="w-[84px] shrink-0 text-body-m font-medium text-text-primary">
                {stage}
              </dt>
              <dd className="flex flex-1 items-center gap-2">
                <span className="w-6 text-right text-body-l font-bold text-text-primary">
                  {count}
                </span>
                <Bar pct={pct} label={`${stage}: ${pct}% of applications`} />
                <span className="w-10 text-right text-body-m font-medium text-text-secondary">
                  {pct}%
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** "AI Insights" (462:52): four observations, each under the board's glyph for its subject. */
export function AiInsightsCard({ insights }: { insights: CareerInsights['aiInsights'] }) {
  return (
    <section aria-labelledby="insights-ai" className={insightPanel}>
      <div className="flex items-center gap-3">
        <NavAiAssistantIllustration aria-hidden className="h-auto w-[30px] shrink-0" />
        <h2 id="insights-ai" className="flex-1 text-title-l text-text-primary">
          AI Insights
        </h2>
        <span className="rounded-full bg-surface-brand-strong px-2.5 py-1 text-micro font-semibold text-text-brand">
          Powered by AI
        </span>
      </div>
      <ul className="mt-5 flex flex-col gap-4">
        {insights.map(({ kind, text }) => {
          const Art = INSIGHT_ART[kind];
          return (
            <li key={kind} className="flex items-start gap-3">
              <span aria-hidden className="flex w-9 shrink-0 justify-center pt-0.5">
                <Art className="h-auto w-9" />
              </span>
              <p className="text-body-m font-medium leading-[19px] text-text-primary">{text}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Top Skills in Demand" and "Target Roles" (463:2, 463:25): five shares as bars. */
export function SharesCard({
  id,
  title,
  subtitle,
  shares,
  link,
}: {
  id: string;
  title: string;
  subtitle: string;
  shares: InsightsShare[];
  /** Where the card leads: Top Skills to the profile's skills (`toreview.md` §102). */
  link?: { href: Route; label: string };
}) {
  return (
    <section aria-labelledby={id} className={insightPanel}>
      <CardHead
        id={id}
        title={title}
        subtitle={subtitle}
        aside={link && <CardLink href={link.href}>{link.label}</CardLink>}
      />
      <dl className="mt-8 flex flex-col gap-[26px]">
        {shares.map(({ label, pct }, index) => (
          <div key={label} className="flex items-center gap-3">
            <dt className="w-[132px] shrink-0 truncate text-body-m font-medium text-text-primary">
              {label}
            </dt>
            <dd className="flex flex-1 items-center gap-3">
              <Bar pct={pct} label={`${label}: ${pct}%`} strong={index === 0} />
              <span className="w-9 text-right text-body-m font-medium text-text-secondary">
                {pct}%
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
