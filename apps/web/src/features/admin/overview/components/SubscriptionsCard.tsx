'use client';

import type { Route } from 'next';

import type { AdminSubscriptions } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { textLink } from '@/ui/textLink';

import { Donut } from '../../charts/Donut';
import { useChartFocus } from '../../charts/useChartFocus';
import { formatCount, formatMoney, formatRate } from '../../format';
import { DeltaBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { CardMenu } from '../../ui/CardMenu';

/** One shade per currency, as the board's donut draws USD, EUR and AUD (Figma 396:618–620). */
const CURRENCY = [
  { stroke: 'stroke-brand-700', dot: 'bg-brand-700' },
  { stroke: 'stroke-brand-500', dot: 'bg-brand-500' },
  { stroke: 'stroke-brand-200', dot: 'bg-brand-200' },
];
const shadeAt = (index: number) => CURRENCY[index % CURRENCY.length]!;

const PLANS = [{ label: 'Open Plans & pricing', href: '/admin/plans' as Route }];

/** Active Pro subscriptions and what they bring in each month, by currency (Figma 396:542). */
export function SubscriptionsCard({ subscriptions }: { subscriptions: AdminSubscriptions | null }) {
  return (
    <AdminCard
      icon="CreditCard02"
      title="Pro subscriptions"
      trailing={<CardMenu label="Pro subscriptions" items={PLANS} />}
      bodyClassName="gap-4"
    >
      {subscriptions ? <Body s={subscriptions} /> : <NotConnected what="subscriptions" />}
    </AdminCard>
  );
}

function Body({ s }: { s: AdminSubscriptions }) {
  const { active, bind } = useChartFocus<string>();
  // Paying Pro subscribers with no revenue listed means the source didn't report it, not that
  // nobody pays: only with no one on Pro is an empty list the empty state.
  const revenue = s.revenue && (s.revenue.length > 0 || s.activePro === 0) ? s.revenue : null;
  type Row = NonNullable<typeof revenue>[number];
  // Shares are of USD value when every currency has one. The server holds no exchange rate, so
  // otherwise they are shares of paying subscribers, and the middle shows no combined total.
  const convertible = (revenue ?? []).every((row) => row.usdMinor !== null);
  const weight = (row: Row) => (convertible ? (row.usdMinor ?? 0) : row.subscribers);
  const total = (revenue ?? []).reduce((sum, row) => sum + weight(row), 0);
  const share = (row: Row) => formatRate(total ? weight(row) / total : 0, 0);
  const shareOf = convertible ? '' : ' of payers';
  const focused = revenue?.find((row) => row.currency === active);
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <p className="animate-reveal text-display-l font-semibold tracking-display tabular-nums text-text-primary">
            {formatCount(s.activePro)}
          </p>
          {s.delta && <DeltaBadge delta={s.delta} />}
        </div>
        <p className="text-body-s text-text-secondary">
          active Pro{s.newThisMonth !== null && ` · +${s.newThisMonth} this month`}
        </p>
      </div>

      {revenue === null ? (
        <NotConnected what="revenue by currency" />
      ) : revenue.length === 0 ? (
        <CardEmpty title="No revenue yet" message="Monthly revenue shows here once people pay." />
      ) : (
        <div className="flex items-center gap-5">
          <Donut
            segments={revenue.map((row, index) => ({
              key: row.currency,
              value: weight(row),
              stroke: shadeAt(index).stroke,
            }))}
            active={active}
            bind={bind}
          >
            {/* The middle names whichever currency is in focus, else the month's total. */}
            <span key={active ?? 'all'} className="flex animate-reveal flex-col items-center">
              <span className="text-body-m font-semibold tabular-nums text-text-primary">
                {focused
                  ? formatMoney(focused.amountMinor, focused.currency)
                  : convertible
                    ? formatMoney(total, 'USD')
                    : formatCount(total)}
              </span>
              <span className="text-caption-m font-normal text-text-tertiary">
                {focused
                  ? `${focused.currency} · ${share(focused)}${shareOf}`
                  : convertible
                    ? 'per month'
                    : 'paying'}
              </span>
            </span>
          </Donut>
          {/* 42px rows on a 54px pitch (396:628–396:638); the focus tint sits outside the box. */}
          <ul className="flex min-w-0 flex-1 flex-col gap-3">
            {revenue.map((row, index) => (
              <li
                key={row.currency}
                tabIndex={0}
                {...bind(row.currency)}
                className={cn(
                  'relative isolate flex cursor-default flex-col gap-0.5 outline-none transition-opacity duration-fast ease-standard',
                  'before:absolute before:-inset-x-2 before:-inset-y-1 before:z-behind before:rounded-sm before:transition-colors before:duration-fast before:ease-standard focus-visible:before:ring-2 focus-visible:before:ring-brand-600',
                  active === row.currency && 'before:bg-neutral-50',
                  active !== null && active !== row.currency && 'opacity-50',
                )}
              >
                <span className="flex items-center gap-1.5 text-caption-m text-text-secondary">
                  <span aria-hidden className={cn('size-2 rounded-full', shadeAt(index).dot)} />
                  {row.currency} · {share(row)}
                  {shareOf}
                </span>
                <span className="text-body-m font-semibold tabular-nums text-text-primary">
                  {formatMoney(row.amountMinor, row.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-1.5 border-t border-neutral-100 pt-3 text-body-s">
        <span className="flex-1 text-text-secondary">
          {s.monthlyShare !== null &&
            `Monthly ${formatRate(s.monthlyShare, 0)} · Annual ${formatRate(1 - s.monthlyShare, 0)}`}
        </span>
        <StripeLink />
      </div>
    </>
  );
}

/** Billing itself lives in Stripe; the board links out to it (Figma 396:642). */
function StripeLink() {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <a
      href="https://dashboard.stripe.com"
      target="_blank"
      rel="noreferrer"
      {...hoverProps}
      className={cn(textLink, 'inline-flex items-center gap-1 font-semibold text-brand-700')}
    >
      Stripe
      <AdminIcon ref={iconRef} name="ArrowUpRight" size="sm" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
