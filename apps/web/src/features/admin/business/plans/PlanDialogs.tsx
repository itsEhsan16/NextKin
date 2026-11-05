'use client';

import { useState } from 'react';

import {
  BUSINESS_CURRENCIES,
  type AdminPlan,
  type BusinessCurrency,
  type PriceSet,
} from '@nextkin/shared/models';
import { useCreatePriceVersion, useGrantComp, useSetPlanQuotas } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { CheckboxRow, TextArea, TextField } from '../../ui/AdminForm';
import { formatPrice, parsePrice } from '../businessFormat';

const failed = (error: unknown) =>
  showToast(error instanceof Error ? error.message : 'That didn’t save. Try again.', {
    tone: 'error',
  });

/** A plan's quotas as editable fields; a quota can be made unlimited (the server's `null`). */
export function EditQuotasDialog({ plan, onClose }: { plan: AdminPlan; onClose: () => void }) {
  const save = useSetPlanQuotas();
  const editable = plan.quotas.filter((quota) => !quota.note);
  const [draft, setDraft] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      editable.map((quota) => [quota.key, quota.limit === null ? null : String(quota.limit)]),
    ),
  );
  const invalid = Object.values(draft).some((value) => value !== null && !/^\d+$/.test(value));

  const submit = () => {
    const quotas = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, value === null ? null : Number(value)]),
    );
    save.mutate(
      { planId: plan.id, quotas },
      {
        onSuccess: () => {
          showToast(`Quotas saved for ${plan.name}`);
          onClose();
        },
        onError: failed,
      },
    );
  };

  return (
    <AdminDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon="Edit03"
      tone="brand"
      title={`Edit quotas · ${plan.name}`}
      description="New limits apply from the next request. The change is recorded in the audit log."
      confirm={{
        label: 'Save quotas',
        onConfirm: submit,
        disabled: invalid,
        busy: save.isPending,
      }}
    >
      <div className="flex flex-col gap-4">
        {editable.map((quota) => {
          const value = draft[quota.key] ?? null;
          return (
            <div key={quota.key} className="flex flex-col gap-2">
              <TextField
                label={quota.label}
                inputMode="numeric"
                value={value ?? ''}
                disabled={value === null}
                placeholder={value === null ? 'Unlimited' : undefined}
                error={
                  value !== null && !/^\d+$/.test(value) ? 'A whole number, 0 or more.' : undefined
                }
                onChange={(event) => setDraft({ ...draft, [quota.key]: event.target.value })}
              />
              <CheckboxRow
                checked={value === null}
                onChange={(unlimited) =>
                  setDraft({
                    ...draft,
                    [quota.key]: unlimited ? null : String(quota.limit ?? 0),
                  })
                }
                label="Unlimited"
              />
            </div>
          );
        })}
      </div>
    </AdminDialog>
  );
}

type PriceDraft = Record<'monthly' | 'annual', Record<BusinessCurrency, string>>;

const toDraft = (prices: PriceSet): Record<BusinessCurrency, string> =>
  Object.fromEntries(
    BUSINESS_CURRENCIES.map((currency) => [currency, (prices[currency] / 100).toFixed(2)]),
  ) as Record<BusinessCurrency, string>;

/**
 * A new price version for both Pro plans. A published version is never edited (406:3226's note):
 * this one replaces it from today, and live subscriptions keep the price they were sold.
 */
export function PriceVersionDialog({
  start,
  nextVersion,
  onClose,
}: {
  start: { monthly: PriceSet; annual: PriceSet };
  nextVersion: number | null;
  onClose: () => void;
}) {
  const create = useCreatePriceVersion();
  const [draft, setDraft] = useState<PriceDraft>({
    monthly: toDraft(start.monthly),
    annual: toDraft(start.annual),
  });
  const parsed = {
    monthly: Object.fromEntries(
      BUSINESS_CURRENCIES.map((c) => [c, parsePrice(draft.monthly[c])]),
    ) as Record<BusinessCurrency, number | null>,
    annual: Object.fromEntries(
      BUSINESS_CURRENCIES.map((c) => [c, parsePrice(draft.annual[c])]),
    ) as Record<BusinessCurrency, number | null>,
  };
  const bad = (value: number | null) => value === null || value <= 0;
  const invalid = [...Object.values(parsed.monthly), ...Object.values(parsed.annual)].some(bad);

  const submit = () =>
    create.mutate(
      { monthly: parsed.monthly as PriceSet, annual: parsed.annual as PriceSet },
      {
        onSuccess: () => {
          showToast(
            nextVersion ? `Price version v${nextVersion} published` : 'New prices published',
          );
          onClose();
        },
        onError: failed,
      },
    );

  return (
    <AdminDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon="CoinsStacked01"
      tone="brand"
      title={nextVersion ? `New price version · v${nextVersion}` : 'New price version'}
      description="New checkouts use these prices from today; live subscriptions keep the price they were sold. The current version is retired, not edited."
      width="lg"
      confirm={{
        label: nextVersion ? `Publish v${nextVersion}` : 'Publish prices',
        onConfirm: submit,
        disabled: invalid,
        busy: create.isPending,
      }}
    >
      {(['monthly', 'annual'] as const).map((period) => (
        <fieldset key={period} className="flex flex-col gap-3">
          <legend className="mb-3 text-body-s font-semibold text-text-primary">
            {period === 'monthly' ? 'Pro monthly, per month' : 'Pro annual, per year'}
          </legend>
          <div className="grid grid-cols-3 gap-3">
            {BUSINESS_CURRENCIES.map((currency) => {
              const value = draft[period][currency];
              return (
                <TextField
                  key={currency}
                  label={currency}
                  required
                  inputMode="decimal"
                  value={value}
                  error={
                    parsePrice(value) === null
                      ? 'A price like 19.50.'
                      : bad(parsePrice(value))
                        ? 'More than zero.'
                        : undefined
                  }
                  hint={
                    bad(parsePrice(value))
                      ? undefined
                      : formatPrice(parsePrice(value) ?? 0, currency, true)
                  }
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      [period]: { ...draft[period], [currency]: event.target.value },
                    })
                  }
                />
              );
            })}
          </div>
        </fieldset>
      ))}
    </AdminDialog>
  );
}

/** Pro for 1–12 months, to a user named by their ID, with a reason the audit log keeps. */
export function GrantCompDialog({ onClose }: { onClose: () => void }) {
  const grant = useGrantComp();
  const [userRef, setUserRef] = useState('');
  const [months, setMonths] = useState('1');
  const [reason, setReason] = useState('');
  const monthsValid = /^\d+$/.test(months) && Number(months) >= 1 && Number(months) <= 12;
  const invalid = userRef.trim().length < 4 || !monthsValid || reason.trim().length < 3;

  const submit = () =>
    grant.mutate(
      { userRef, months: Number(months), reason },
      {
        onSuccess: () => {
          showToast(`Pro comped for ${months} month${months === '1' ? '' : 's'}`);
          onClose();
        },
        onError: failed,
      },
    );

  return (
    <AdminDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon="UserPlus01"
      tone="brand"
      title="Grant comped access"
      description="The user gets Pro free for the months you choose, then returns to their plan. Recorded in the audit log."
      confirm={{
        label: 'Grant comped access',
        onConfirm: submit,
        disabled: invalid,
        busy: grant.isPending,
      }}
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="User ID"
          required
          value={userRef}
          onChange={(event) => setUserRef(event.target.value)}
          hint="From the user’s page. Tables show only its last four characters."
          autoComplete="off"
        />
        <TextField
          label="Months"
          required
          inputMode="numeric"
          value={months}
          onChange={(event) => setMonths(event.target.value)}
          error={monthsValid ? undefined : 'From 1 to 12 months.'}
          hint="From 1 to 12."
        />
        <TextArea
          label="Reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint="Only staff see this. It’s saved with the audit entry."
        />
      </div>
    </AdminDialog>
  );
}
