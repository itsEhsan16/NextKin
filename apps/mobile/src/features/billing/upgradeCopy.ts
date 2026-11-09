import type { Plan, PlanFeature, SubscriptionPlan, SubscriptionUsage } from '@/data/models';
import { formatShortDate } from '@/lib';

import type { UpgradeReason } from './upgradeReasons';

/**
 * Every word and number the plan screen says, kept pure so it reads (and tests) without mounting
 * a page. Three V2 rules are copy rules rather than layout ones, so they are enforced here:
 * §13.5 wants the upsell to name the limit that was actually hit, §13.1 forbids an unpublished
 * cap, and §13.3 keeps PDF export free and unwatermarked on every plan.
 */

/**
 * One honest line per reason a gated control sends the reader here. No line promises an outcome,
 * and none carries a count: the usage card underneath is the live meter, and a number written
 * into the banner too would be the same fact printed twice and read out twice.
 */
export const REASON_LINE: Record<UpgradeReason, string> = {
  docx: 'DOCX export is a Pro feature. PDF and TXT stay free on every plan.',
  generations: "You've used this month's resume generations.",
  cover_letters: "You've used this month's cover letter allowance.",
  ats_checks: "You've used this month's standalone ATS checks.",
  saved_jobs: 'Free saves up to 10 jobs. Pro lifts that cap.',
  versions: 'Free keeps the last 3 versions of a document. Pro keeps the last 20.',
  assistant: 'The assistant runs to a daily cap on Free. Pro raises it and answers first.',
  interview: 'Free includes one question set per resume. Pro regenerates as often as you like.',
};

/** The meters the fixtures actually carry, in the order the usage card draws them. */
export type UsageMeterKey = 'generations' | 'cover_letters' | 'ats_checks' | 'assistant';

export type UsageMeter = {
  key: UsageMeterKey;
  label: string;
  used: number;
  limit: number;
  /** "2 of 3 used" — the published cap, never a bare percentage. */
  line: string;
  /** Which period the cap is over. The assistant's is daily; the rest are monthly. */
  period: 'month' | 'day';
  /** 0–1, for the bar. */
  fraction: number;
};

/** Which meter a reason is about. Four of the seven gate a feature rather than an allowance. */
export const REASON_METER: Partial<Record<UpgradeReason, UsageMeterKey>> = {
  generations: 'generations',
  cover_letters: 'cover_letters',
  ats_checks: 'ats_checks',
  assistant: 'assistant',
};

const METER_LABEL: Record<UsageMeterKey, string> = {
  generations: 'Resume generations',
  cover_letters: 'Cover letters',
  ats_checks: 'ATS checks',
  assistant: 'Assistant messages',
};

const METER_PERIOD: Record<UsageMeterKey, 'month' | 'day'> = {
  generations: 'month',
  cover_letters: 'month',
  ats_checks: 'month',
  assistant: 'day',
};

const meter = (key: UsageMeterKey, used: number, limit?: number): UsageMeter | undefined => {
  // An absent limit is an allowance this account does not meter, and a zero one is nothing to
  // draw: "0 of 0 used" is not a sentence, and a full bar under it would read as a spent quota.
  if (limit == null || limit <= 0) return undefined;
  const label = METER_LABEL[key];
  return {
    key,
    label,
    used,
    limit,
    line: `${Math.min(used, limit)} of ${limit} used`,
    period: METER_PERIOD[key],
    fraction: Math.max(0, Math.min(1, used / limit)),
  };
};

/** The metered allowances V2 §13.5 wants on screen before any work starts. */
export function usageMeters(usage: SubscriptionUsage): UsageMeter[] {
  return [
    meter('generations', usage.generationsUsed, usage.generationsLimit),
    meter('cover_letters', usage.coverLettersUsed, usage.coverLettersLimit),
    meter('ats_checks', usage.atsChecksUsed ?? 0, usage.atsChecksLimit),
    meter('assistant', usage.assistantMessagesUsed ?? 0, usage.assistantMessagesLimit),
  ].filter((row): row is UsageMeter => row != null);
}

/**
 * Caps §13.3 publishes per DOCUMENT rather than per period: one line and no bar. Interview
 * practice on Free is "1 question set per resume", so "1 of 1 used" under a bar would be a lie —
 * the account is not out of sets, it is out of sets for one resume. §13.1 still wants the cap
 * published, so it is said in words.
 */
export type PublishedCap = { key: 'interview'; label: string; line: string };

export function publishedCaps(usage: SubscriptionUsage, plan: SubscriptionPlan): PublishedCap[] {
  const limit = usage.interviewSetsLimit;
  if (limit == null || limit <= 0) return [];
  return [
    {
      key: 'interview',
      label: 'Interview practice',
      line:
        plan === 'pro'
          ? 'Regenerate as often as you like'
          : `${limit === 1 ? '1 set' : `${limit} sets`} per resume on Free`,
    },
  ];
}

/** INR is the mock's market; the backend prices in USD, EUR and AUD (§13.2, P12-08). */
const CURRENCY_SYMBOL: Record<Plan['price']['currency'], string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  AUD: 'A$',
};

export const PERIOD_SUFFIX: Record<Plan['price']['period'], string> = {
  month: '/mo',
  year: '/yr',
};

/**
 * Indian digit grouping — the last three digits, then pairs ("7,999", "1,00,000"). Written out
 * rather than handed to `toLocaleString('en-IN')` because Hermes and Node ship different ICU
 * data: the same price would group one way in a test and another way on the device.
 */
export function groupInr(amount: number): string {
  const digits = String(Math.round(Math.abs(amount)));
  if (digits.length <= 3) return digits;
  const tail = digits.slice(-3);
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${head},${tail}`;
}

/** Western grouping, with cents only when there are any ("19", "1,234.50"). Same ICU reasoning as above. */
export function groupWestern(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rest = cents % 100;
  return rest ? `${whole}.${String(rest).padStart(2, '0')}` : whole;
}

/** An amount in its currency: "₹1,499", "$19", "€109". */
export function formatMoney(amount: number, currency: Plan['price']['currency']): string {
  return `${CURRENCY_SYMBOL[currency]}${currency === 'INR' ? groupInr(amount) : groupWestern(amount)}`;
}

/** "₹1,499", "$19", and "Free" for a plan that costs nothing. */
export function formatPlanPrice(price: Plan['price']): string {
  if (price.amount <= 0) return 'Free';
  return formatMoney(price.amount, price.currency);
}

/**
 * The price with the period it is actually billed over: "₹1,499/mo", "₹7,999/yr".
 *
 * The annual SKU is deliberately not divided into a monthly-looking figure. ₹7,999 a year is one
 * charge of ₹7,999, and a "₹667/mo" button would name a price nothing ever bills — the saving
 * line below is where the annual case is argued, in money the reader can check.
 */
export function formatPlanPricePeriod(price: Plan['price']): string {
  if (price.amount <= 0) return 'Free';
  return `${formatPlanPrice(price)}${PERIOD_SUFFIX[price.period]}`;
}

/**
 * The price split the way BILLING 01 sets it (577:9271): the figure large, the period beside it
 * small — "₹1,499" and "/mo". Same rule as above: the annual SKU stays one yearly charge.
 */
export function planPriceParts(price: Plan['price']): { figure: string; suffix: string } {
  if (price.amount <= 0) return { figure: 'Free', suffix: '' };
  return { figure: formatPlanPrice(price), suffix: PERIOD_SUFFIX[price.period] };
}

/** The sticky bar's primary. */
export const upgradeCtaLabel = (plan: Plan): string =>
  `Upgrade to Pro — ${formatPlanPricePeriod(plan.price)}`;

export type AnnualSaving = { amount: number; percent: number; currency: Plan['price']['currency'] };

/**
 * What paying once beats paying twelve times by, computed from the two SKUs rather than written
 * down: a fixture price change must move this number with it. The percentage rounds DOWN, so the
 * claim is understated rather than overstated.
 */
export function annualSaving(monthly?: Plan, annual?: Plan): AnnualSaving | undefined {
  if (!monthly || !annual) return undefined;
  if (monthly.price.period !== 'month' || annual.price.period !== 'year') return undefined;
  const overAYear = monthly.price.amount * 12;
  const amount = overAYear - annual.price.amount;
  if (overAYear <= 0 || amount <= 0) return undefined;
  return {
    amount,
    percent: Math.floor((amount / overAYear) * 100),
    currency: monthly.price.currency,
  };
}

/** "Save ₹9,989 a year — 55% less than paying monthly." */
export const annualSavingLine = (saving: AnnualSaving): string =>
  `Save ${formatMoney(saving.amount, saving.currency)} a year — ${saving.percent}% less than paying monthly.`;

/**
 * How one cell of the comparison table reads. A published cap is never swapped for a tick
 * (§13.1): only a cell that is genuinely a yes or a no becomes a glyph.
 */
export type PlanCell =
  | { kind: 'yes'; text: string }
  | { kind: 'no'; text: string }
  | { kind: 'locked'; text: string }
  | { kind: 'text'; text: string };

const YES_CELLS = new Set(['Included']);
const NO_CELLS = new Set(['Not included', 'None']);

export function planCell(value: string, locked = false): PlanCell {
  if (locked) return { kind: 'locked', text: value };
  if (YES_CELLS.has(value)) return { kind: 'yes', text: value };
  if (NO_CELLS.has(value)) return { kind: 'no', text: value };
  return { kind: 'text', text: value };
}

/** What a screen reader hears for one comparison row, as one sentence instead of three stops. */
export const featureRowLabel = (feature: PlanFeature): string =>
  `${feature.label}. Free: ${feature.free}. Pro: ${feature.pro}.`;

export const FREE_COLUMN = 'Free';
export const PRO_COLUMN = 'Pro';

/** V2 §13.4 / §15 — the web is the purchase surface, and the bar says so before the press. */
export const BILLING_NOTE = "Billing runs on the web — you'll get a receipt by email";

/** BILLING 01 (577:9171). The Pro reader is not told to upgrade to the plan they are on. */
export const HERO_CAPTION =
  'See what each plan includes and what you have used, then upgrade when you need more.';
export const PRO_HERO_CAPTION = 'See what your plan includes and what you have used.';
export const USAGE_TITLE = 'Usage';
export const PLAN_SECTION_TITLE = 'Choose your plan';
export const COMPARISON_TITLE = 'What you get';

/** The pill on the usage card's header (577:9196). */
export const planPillLabel = (plan: SubscriptionPlan): string =>
  plan === 'pro' ? 'Pro plan' : 'Free plan';

export const TRUST_LINE = 'No trials that auto-renew. Cancel any time.';

export const CHECKOUT_TITLE = 'Continue to checkout?';
export const CHECKOUT_MESSAGE =
  "Payment is taken on the NextKin website. We'll open it here, and your plan updates in the app as soon as it goes through.";
export const CHECKOUT_FAILED =
  "We couldn't start checkout. Check your connection and try again — nothing has been charged.";
export const CHECKOUT_CONFIRM = 'Continue';
export const CHECKOUT_RETRY = 'Try again';
export const CHECKOUT_CANCEL = 'Not now';
export const UPGRADED_TOAST = "You're on NextKin Pro";

export const PRO_TITLE = "You're on NextKin Pro";
export const MANAGE_CTA = 'Manage on the web';

/**
 * The inert label the loading bar wears. Which bar the page ends up with depends on a plan that
 * has not arrived yet, so this names the page's purpose rather than an action — and being
 * disabled, it promises nothing while it stands in.
 */
export const LOADING_CTA = 'Upgrade to Pro';
export const MANAGE_NOTE = 'Change or cancel your plan on the web.';
export const MANAGE_UNAVAILABLE =
  "We couldn't open the browser. Go to nextkin.ai on any device to manage your plan.";
/** The account page the manage action opens; the app never takes payment itself (§13.4). */
export const BILLING_PATH = '/settings?tab=billing';

/** "Renews on 12 Oct" — absent renewal dates say nothing rather than guessing at one. */
export function renewalLine(renewsAt?: string, now: Date = new Date()): string | undefined {
  if (!renewsAt) return undefined;
  const date = formatShortDate(renewsAt, now);
  return date ? `Renews on ${date}` : undefined;
}

export const PLANS_ERROR_TITLE = "Couldn't load the plans";
export const PLANS_ERROR_MESSAGE = 'Check your connection and try again.';

// ——— The Go Pro screen (owner's Figma "C · Compare", 2026-11-09, §200) ———

export const GO_PRO_EYEBROW = 'NEXTKIN PRO';
export const GO_PRO_TITLE = 'Go Pro';
export const GO_PRO_LEDE = 'More of what gets you hired,\nnone of the waiting.';
export const GO_PRO_OFFER_TITLE = 'Go Pro now';
export const GO_PRO_CTA = 'Start Pro';
export const GO_PRO_STAY_FREE = 'Continue with Free';

/**
 * The offer card's line for the period picked: a year as its monthly figure (rounded to the whole
 * unit, as "From ₹667 a month"), a month as its own price. Both honest about how it is billed.
 */
export function goProOfferLine(plan: Plan): string {
  const { amount, currency, period } = plan.price;
  return period === 'year'
    ? `From ${formatMoney(Math.round(amount / 12), currency)} a month, billed yearly`
    : `${formatMoney(amount, currency)} a month, cancel any time`;
}

/** "Save 55%": the switch's and the card's badge, from the real prices, never a rounded-up claim. */
export const goProSaveBadge = (saving: AnnualSaving): string => `Save ${saving.percent}%`;
