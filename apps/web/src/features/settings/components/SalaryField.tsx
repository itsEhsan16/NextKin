'use client';

import type { SalaryCurrency, SalaryRange } from '@nextkin/shared/models';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { fieldBox } from '@/ui/fieldBox';
import { SelectField } from '@/ui/SelectField';

import { CURRENCY_LABEL, CURRENCY_OPTIONS, formatAmount, parseAmount } from '../preferencesLibrary';

export type SalaryFieldProps = {
  value: SalaryRange | undefined;
  onChange: (next: SalaryRange | undefined) => void;
  disabled: boolean;
};

/**
 * "INR (₹) · 12,00,000 · per year" (356:75): a currency, a yearly amount, and no minimum at all
 * when the amount is cleared. The amount is kept as typed and saved when the field is left,
 * grouped the way its currency is (lakhs for rupees).
 */
export function SalaryField({ value, onChange, disabled }: SalaryFieldProps) {
  const currency: SalaryCurrency = value?.currency ?? 'INR';
  // What is being typed; null shows the saved amount.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value?.min != null ? formatAmount(value.min, currency) : '');

  const commit = () => {
    if (draft == null) return;
    setDraft(null);
    const amount = parseAmount(draft);
    if (amount === value?.min) return;
    onChange(amount == null ? undefined : { currency, min: amount, period: 'year' });
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <SelectField
        label="Salary currency"
        value={currency}
        options={CURRENCY_OPTIONS}
        labelOf={(option) => CURRENCY_LABEL[option]}
        onChange={(next) => onChange({ currency: next, min: value?.min, period: 'year' })}
        disabled={disabled}
        className="w-28 shrink-0"
      />
      <input
        type="text"
        inputMode="numeric"
        aria-label="Minimum salary amount"
        placeholder="Amount"
        value={shown}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className={cn(fieldBox, 'px-3 placeholder:text-text-tertiary')}
      />
      <span className="shrink-0 text-body-s text-text-tertiary">per year</span>
    </div>
  );
}
