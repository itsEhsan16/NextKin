'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';

import { AccentWord } from '../parts/AccentWord';

/** Plans (534:826), copy and prices exactly as the board has them (USD, toreview §216). */
const FREE = [
  '3 resume generations a month',
  'Clean PDF and TXT — no watermark',
  '3 ATS checks a month',
  '1 cover letter a month',
  'Interview questions for each resume',
  'Job board and up to 10 saved jobs',
  'AI assistant (daily limit)',
];
const PRO = [
  'Up to 100 resume generations a month',
  'Word (DOCX) export',
  '30 ATS checks a month',
  'Unlimited cover letters (fair use)',
  'Unlimited interview question sets',
  'Full template library, 20 versions each',
  'Unlimited saved jobs',
  'More AI assistant messages, priority queue',
];
const TEAM = [
  'Team workspace and member management',
  'Bulk resume review with AI',
  'Analytics and reports',
  'Custom branding',
  'Dedicated account manager',
  'Priority support',
];

type Billing = 'monthly' | 'annual';

/**
 * Pro's price for each billing period: the server's price book (spec §13.2, toreview §105), which
 * is what checkout charges. Annual is $109 a year, about $9.08 a month: 52% under 12 × $19, so the
 * board's "Save over 45%" holds. If the price book changes, change these too.
 */
const PRO_PRICE: Record<Billing, { amount: string; per: string; note: string }> = {
  monthly: { amount: '$19', per: 'per month', note: 'Billed monthly. Cancel anytime.' },
  annual: {
    amount: '$109',
    per: 'per year',
    // Kept to one line so the card doesn't change height when the toggle flips.
    note: 'About $9.08/mo, billed yearly. Cancel anytime.',
  },
};

/**
 * Billing toggle (534:816). No motion (owner, 2026-11-20). Switching it changes the Pro card's
 * price and billing line (owner, 2026-11-21: "make the annually functional").
 */
function BillingToggle({
  billing,
  setBilling,
}: {
  billing: Billing;
  setBilling: (b: Billing) => void;
}) {
  const options: { id: Billing; label: string }[] = [
    { id: 'monthly', label: 'Monthly' },
    { id: 'annual', label: 'Annually' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      data-pricing-toggle
      className="flex items-center gap-1.5 rounded-full border-[1.2px] border-[#e7e6f3] bg-lp-white p-[7px] shadow-[0_6px_18px_0_rgba(27,22,80,0.05)]"
    >
      {options.map((o) => {
        const on = billing === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setBilling(o.id)}
            className={cn(
              'relative flex items-center gap-2.5 rounded-full px-3 py-2 sm:px-3.5',
              on && 'bg-lp-violet-soft',
            )}
          >
            <img
              src={on ? '/landing/pricing-radio-on.svg' : '/landing/pricing-radio-off.svg'}
              alt=""
              width={20}
              height={20}
              className="relative"
            />
            <span
              className={cn(
                'relative text-[15px] whitespace-nowrap sm:text-base',
                on ? 'font-semibold text-lp-heading' : 'font-medium text-lp-copy',
              )}
            >
              {o.label}
            </span>
            {o.id === 'annual' ? (
              <span className="relative hidden rounded-full bg-lp-violet-soft px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-lp-violet min-[400px]:inline">
                Save over 45%
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function Features({ items, light = false }: { items: string[]; light?: boolean }) {
  return (
    <ul className="flex w-full flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <img
            src={light ? '/landing/pricing-check-white.svg' : '/landing/pricing-check.svg'}
            alt=""
            width={18}
            height={18}
            className="mt-[3px] shrink-0"
          />
          <span className={cn('text-base', light ? 'text-[#eef2ff]' : 'text-lp-ink-2')}>
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

const SIDE_CARD =
  'flex w-full flex-col items-start rounded-[28px] border-[1.5px] border-lp-tile-line bg-lp-white p-7 drop-shadow-[0_10px_15px_rgba(27,22,80,0.05)] sm:p-10 lg:p-8 xl:h-[692.4px] xl:p-10';
const OUTLINE_BUTTON =
  'flex w-full items-center justify-center rounded-[14px] border-[1.2px] border-[#dcdbe8] bg-lp-white px-6 py-[15px] text-[17px] font-semibold text-lp-ink-2 transition-colors hover:border-lp-violet hover:text-lp-violet';

/**
 * 10 Pricing (Figma 534:802). Free, Pro and Team (coming soon). The Pro card follows the newer
 * Plan Pro design (NEXKTKIN-PVT 678:71). No motion in this section (owner, 2026-11-20).
 */
export function Pricing() {
  const [billing, setBilling] = useState<Billing>('monthly');
  const pro = PRO_PRICE[billing];
  return (
    <section id="pricing" className="relative mt-20 scroll-mt-24 px-5 lg:mt-[100px] lg:px-10">
      <div className="relative mx-auto flex max-w-[1360px] flex-col items-center text-center">
        {/* Glows (534:803–805), behind everything. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <img
            src="/landing/pricing-glow-1.svg"
            alt=""
            className="absolute top-[280px] left-[79.7%] size-[760px] max-w-none -translate-x-[120px] -translate-y-[120px]"
          />
          <img
            src="/landing/pricing-glow-2.svg"
            alt=""
            className="absolute top-[560px] -left-[140px] size-[720px] max-w-none -translate-x-[120px] -translate-y-[120px]"
          />
          <img
            src="/landing/pricing-glow-3.svg"
            alt=""
            className="absolute top-[640px] left-[79.4%] size-[660px] max-w-none -translate-x-[120px] -translate-y-[120px]"
          />
        </div>

        <div className="relative inline-flex items-center gap-2.5 rounded-full bg-lp-violet-soft py-1.5 pr-4 pl-1.5">
          <span className="flex size-7 items-center justify-center rounded-[14px] bg-lp-violet">
            <img src="/landing/pricing-sparkle.svg" alt="" width={14} height={14} />
          </span>
          <span className="text-lp-eyebrow font-semibold text-lp-ink-2">Pricing</span>
        </div>

        <h2 className="relative mt-[22px] text-[36px] leading-[44px] font-semibold tracking-[-1px] text-lp-heading sm:text-[44px] sm:leading-[52px] lg:text-[54px] lg:leading-[62px] lg:tracking-[-1.35px]">
          Choose the perfect plan
          <br />
          for your <AccentWord className="text-lp-violet">career</AccentWord>.
        </h2>
        <p className="relative mt-[18px] max-w-[600px] text-[17px] leading-[27px] text-lp-copy sm:text-lp-body-l sm:leading-[30px]">
          Build a standout resume, find the right jobs, prepare for interviews and get AI-powered
          support — all in one place.
        </p>

        <div className="relative mt-[30px]">
          <BillingToggle billing={billing} setBilling={setBilling} />
        </div>

        <div className="relative mt-16 grid w-full max-w-[480px] grid-cols-1 items-center gap-6 lg:max-w-none lg:grid-cols-3 xl:max-w-[1320px]">
          {/* Free */}
          <div className={cn(SIDE_CARD, 'text-left')}>
            <p className="text-[30px] font-semibold tracking-[-0.45px] text-lp-heading">Free</p>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-[58px] leading-none font-bold tracking-[-1.74px] text-lp-heading">
                $0
              </span>
              <span className="pb-1.5 text-lg font-medium text-lp-heading/85">Forever</span>
            </div>
            <p className="mt-3 text-[17px] leading-[26px] text-lp-copy">
              Everything you need for one job search, at no cost.
            </p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full load: on nextkin.ai the proxy sends /sign-up to the app host */}
            <a href="/sign-up" className={cn(OUTLINE_BUTTON, 'mt-[26px]')}>
              Start free
            </a>
            <p className="mt-3 w-full text-center text-sm text-lp-copy">No card needed.</p>
            <div className="my-[26px] h-px w-full bg-lp-tile-line" />
            <p className="mb-4 text-[17px] font-semibold text-lp-heading">Free plan includes</p>
            <Features items={FREE} />
          </div>

          {/* Pro: the landing board's size, with the Plan Pro look (NEXKTKIN-PVT 678:71). */}
          <div
            className="relative order-first flex w-full flex-col items-start overflow-clip rounded-[28px] border-2 border-[#7c6cff] px-7 py-10 text-left shadow-[0_18px_44px_0_rgba(74,51,219,0.28)] sm:px-10 sm:py-11 lg:order-none lg:px-8 xl:px-10"
            style={{
              backgroundImage: 'linear-gradient(127.5deg, #5b44f2 7.14%, #3b1fb0 78.57%)',
            }}
          >
            {/* "Most popular" (678:153): a tab hanging from the card's top edge. */}
            <div className="absolute top-0 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-b-[20px] border border-t-0 border-[#8b7cff] bg-[#6d5cf6] px-4 py-[7px] whitespace-nowrap text-lp-white">
              <svg aria-hidden viewBox="0 0 640 512" width={17} height={13} fill="currentColor">
                <path d="M528 448H112c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h416c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16zm64-320c-26.5 0-48 21.5-48 48 0 7.1 1.6 13.7 4.4 19.8L476 239.2c-15.4 9.2-35.3 4-44.2-11.6L350.3 85C361 76.2 368 63 368 48c0-26.5-21.5-48-48-48s-48 21.5-48 48c0 15 7 28.2 17.7 37l-81.5 142.6c-8.9 15.6-28.9 20.8-44.2 11.6l-72.3-43.4c2.7-6 4.4-12.7 4.4-19.8 0-26.5-21.5-48-48-48S0 149.5 0 176s21.5 48 48 48c2.6 0 5.2-.4 7.7-.8L128 416h384l72.3-192.8c2.5.4 5.1.8 7.7.8 26.5 0 48-21.5 48-48s-21.5-48-48-48z" />
              </svg>
              <span className="text-sm leading-[18px] font-medium">Most popular</span>
            </div>
            <p className="text-[30px] font-semibold tracking-[-0.45px] text-lp-white">Pro</p>
            <div className="mt-4 flex items-end gap-3" aria-live="polite">
              <span className="text-[58px] leading-none font-extrabold tracking-[-1.74px] text-lp-white">
                {pro.amount}
              </span>
              <span className="pb-1.5 text-lg font-medium text-lp-white">{pro.per}</span>
            </div>
            <p className="mt-3 text-[17px] leading-[26px] text-[#e0e7ff]">
              For an active search — tailor for every job you want.
            </p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full load: on nextkin.ai the proxy sends /sign-up to the app host */}
            <a
              href="/sign-up"
              className="mt-[26px] flex w-full items-center justify-center rounded-[14px] bg-lp-white px-6 py-[15px] text-[17px] font-semibold text-[#0f172a] shadow-[0_4px_10px_0_rgba(15,23,41,0.12)] transition-colors hover:bg-[#f5f3ff]"
            >
              Upgrade to Pro
            </a>
            {/* Both billing lines share one grid cell and only the chosen one shows, so the cell
                is always as tall as the longer line and the card never jumps when toggling. */}
            <div className="mt-3 grid w-full text-center text-sm font-medium text-[#c7d2fe]">
              {(Object.keys(PRO_PRICE) as Billing[]).map((b) => (
                <p
                  key={b}
                  aria-hidden={b !== billing}
                  className={cn('[grid-area:1/1]', b !== billing && 'invisible')}
                >
                  {PRO_PRICE[b].note}
                </p>
              ))}
            </div>
            <div className="my-[26px] h-px w-full bg-lp-white/22" />
            <p className="mb-4 text-[17px] font-bold text-lp-white">Everything in Free, plus</p>
            <Features items={PRO} light />
            {/* The Plan Pro inner depth: darker at the edges, like pressed glass. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_-10px_-10px_20px_4px_rgba(0,0,0,0.25),inset_10px_10px_20px_4px_rgba(0,0,0,0.31)]"
            />
          </div>

          {/* Team */}
          <div className={cn(SIDE_CARD, 'text-left')}>
            <div className="flex items-center gap-3">
              <p className="text-[30px] font-semibold tracking-[-0.45px] text-lp-heading">Team</p>
              <span className="rounded-full bg-[#f1f0f7] px-2.5 py-1 text-[13px] font-medium text-lp-body">
                Coming soon
              </span>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-[48px] leading-none font-bold tracking-[-1.44px] text-lp-heading">
                Custom
              </span>
              <span className="pb-1 text-lg font-medium text-lp-heading/85">pricing</span>
            </div>
            <p className="mt-3 text-[17px] leading-[26px] text-lp-copy">
              For career coaches, schools and organisations.
            </p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full load: on nextkin.ai the proxy sends /sign-up to the app host */}
            <a href="/sign-up" className={cn(OUTLINE_BUTTON, 'mt-[26px]')}>
              Join the waitlist
            </a>
            <p className="mt-3 w-full text-center text-sm text-lp-copy">
              We’ll email you when it opens.
            </p>
            <div className="my-[26px] h-px w-full bg-lp-tile-line" />
            <p className="mb-4 text-[17px] font-semibold text-lp-heading">Planned for Team</p>
            <Features items={TEAM} />
          </div>
        </div>
      </div>
    </section>
  );
}
