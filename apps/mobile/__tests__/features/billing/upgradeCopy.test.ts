import { plansFixture, subscriptionFixture } from '@/data/mock';
import type { Plan } from '@/data/models';
import {
  annualSaving,
  annualSavingLine,
  formatPlanPrice,
  formatPlanPricePeriod,
  groupInr,
  planCell,
  REASON_LINE,
  upgradeCtaLabel,
  UPGRADE_REASONS,
  usageMeters,
} from '@/features/billing';

/** V2 §7.8 names these as the systems no NextKin copy may claim a result in. */
const THIRD_PARTY_ATS = ['Workday', 'Greenhouse', 'Taleo', 'Lever', 'iCIMS'];

const planById = (id: Plan['id']): Plan => {
  const plan = plansFixture.find((candidate) => candidate.id === id);
  if (!plan) throw new Error(`fixture is missing ${id}`);
  return plan;
};

const free = planById('free');
const monthly = planById('pro_monthly');
const annual = planById('pro_annual');

describe('upgradeCopy — reason lines (V2 §13.5)', () => {
  it('has one honest line for every reason a gated control can pass', () => {
    for (const reason of UPGRADE_REASONS) {
      const line = REASON_LINE[reason];
      expect(typeof line).toBe('string');
      expect(line.trim().length).toBeGreaterThan(0);
      // A line that ends without a full stop is a fragment, not a sentence said to a person.
      expect(line.trimEnd().endsWith('.')).toBe(true);
    }
    expect(Object.keys(REASON_LINE).sort()).toEqual([...UPGRADE_REASONS].sort());
  });

  it('never claims a result in a named third-party ATS (§7.8)', () => {
    const all = Object.values(REASON_LINE).join(' ');
    for (const name of THIRD_PARTY_ATS) expect(all).not.toContain(name);
  });

  it('keeps PDF free on every plan in the DOCX line (§13.3)', () => {
    expect(REASON_LINE.docx).toContain('PDF and TXT stay free on every plan');
  });
});

describe('upgradeCopy — prices', () => {
  it('groups rupees the Indian way, without leaning on the engine ICU data', () => {
    expect(groupInr(0)).toBe('0');
    expect(groupInr(999)).toBe('999');
    expect(groupInr(1499)).toBe('1,499');
    expect(groupInr(17988)).toBe('17,988');
    expect(groupInr(100000)).toBe('1,00,000');
    expect(groupInr(12345678)).toBe('1,23,45,678');
  });

  it('formats the fixture SKUs', () => {
    expect(formatPlanPrice(free.price)).toBe('Free');
    expect(formatPlanPrice(monthly.price)).toBe('₹1,499');
    expect(formatPlanPricePeriod(monthly.price)).toBe('₹1,499/mo');
    // The annual SKU keeps the period it is actually billed over rather than being divided into
    // a monthly-looking figure nothing ever charges.
    expect(formatPlanPricePeriod(annual.price)).toBe('₹7,999/yr');
    expect(formatPlanPricePeriod(free.price)).toBe('Free');
  });

  it('prices the sticky bar from the selected SKU', () => {
    expect(upgradeCtaLabel(monthly)).toBe('Upgrade to Pro — ₹1,499/mo');
    expect(upgradeCtaLabel(annual)).toBe('Upgrade to Pro — ₹7,999/yr');
  });
});

describe('upgradeCopy — the annual saving', () => {
  it('computes the saving from the two fixture prices, rounding the claim down', () => {
    // 1,499 × 12 = 17,988 against 7,999 — a saving of 9,989, or 55.5%, published as 55.
    expect(annualSaving(monthly, annual)).toEqual({ amount: 9989, percent: 55 });
  });

  it('reads as money the reader can check', () => {
    const saving = annualSaving(monthly, annual);
    expect(saving).toBeDefined();
    expect(saving && annualSavingLine(saving)).toBe(
      'Save ₹9,989 a year — 55% less than paying monthly.',
    );
  });

  it('claims nothing when there is nothing to claim', () => {
    expect(annualSaving(monthly, undefined)).toBeUndefined();
    expect(annualSaving(undefined, annual)).toBeUndefined();
    // An annual price above twelve monthly ones is not a saving, so no line is offered.
    const dearer: Plan = { ...annual, price: { ...annual.price, amount: 20000 } };
    expect(annualSaving(monthly, dearer)).toBeUndefined();
    // Neither is the same money paid a different way.
    const level: Plan = { ...annual, price: { ...annual.price, amount: 17988 } };
    expect(annualSaving(monthly, level)).toBeUndefined();
  });
});

describe('upgradeCopy — the usage meters (V2 §13.5)', () => {
  it('meters every allowance the account actually carries, naming its published cap', () => {
    expect(usageMeters(subscriptionFixture.usage)).toEqual([
      expect.objectContaining({
        key: 'generations',
        label: 'Resume generations',
        line: '2 of 3 used',
      }),
      expect.objectContaining({
        key: 'cover_letters',
        label: 'Cover letters',
        line: '1 of 1 used',
      }),
      expect.objectContaining({ key: 'ats_checks', label: 'ATS checks', line: '1 of 3 used' }),
      // The one daily cap in §13.3 (the fixture seeds 12 of 20).
      expect.objectContaining({
        key: 'assistant',
        label: 'Assistant messages',
        line: '12 of 20 used',
        period: 'day',
      }),
    ]);
  });

  it('skips an allowance this account does not meter rather than drawing "0 of 0"', () => {
    const rows = usageMeters({
      ...subscriptionFixture.usage,
      atsChecksLimit: undefined,
      coverLettersLimit: 0,
      assistantMessagesLimit: undefined,
    });
    expect(rows.map((row) => row.key)).toEqual(['generations']);
  });

  it('never lets a spent allowance overflow its bar or its count', () => {
    const rows = usageMeters({
      ...subscriptionFixture.usage,
      generationsUsed: 9,
      generationsLimit: 3,
    });
    expect(rows[0]?.line).toBe('3 of 3 used');
    expect(rows[0]?.fraction).toBe(1);
  });
});

describe('upgradeCopy — comparison cells (V2 §13.1)', () => {
  it('never replaces a published cap with a tick', () => {
    expect(planCell('3 / month')).toEqual({ kind: 'text', text: '3 / month' });
    expect(planCell('Last 3 versions')).toEqual({ kind: 'text', text: 'Last 3 versions' });
  });

  it('reads a genuine yes or no as a glyph', () => {
    expect(planCell('Included').kind).toBe('yes');
    expect(planCell('Not included').kind).toBe('no');
  });

  it('marks the Free side of a gated row as locked', () => {
    expect(planCell('Pro only', true)).toEqual({ kind: 'locked', text: 'Pro only' });
  });
});
