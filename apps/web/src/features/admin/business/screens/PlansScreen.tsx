'use client';

import { useState } from 'react';

import type { AdminPlan, PriceSet } from '@nextkin/shared/models';
import { useAdminPlans, useAdminPriceBook } from '@nextkin/shared/queries';

import { StateView } from '@/ui/StateView';

import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { AdminPage } from '../../ui/AdminPage';
import { adminButton } from '../../ui/adminButton';
import { CompedAccessCard } from '../plans/CompedAccessCard';
import { PlanCard, PlanCardSkeleton, planBadge } from '../plans/PlanCard';
import { EditQuotasDialog, GrantCompDialog, PriceVersionDialog } from '../plans/PlanDialogs';
import { PriceBookCard } from '../plans/PriceBookCard';
import { ExternalLink, IconButton, NoteBar } from '../ui/BusinessParts';

const STRIPE = 'https://dashboard.stripe.com';

type Open =
  | { kind: 'quotas'; plan: AdminPlan }
  | { kind: 'price'; start: { monthly: PriceSet; annual: PriceSet } }
  | { kind: 'comp' }
  | null;

/**
 * Plans & pricing (Figma 406:2873): the three plans with their quotas, the price book, comped
 * access, and the note that refunds live in Stripe. Every change goes through a dialog and is
 * audited.
 */
export function PlansScreen() {
  const plans = useAdminPlans();
  const book = useAdminPriceBook();
  const [open, setOpen] = useState<Open>(null);

  const all = plans.data ?? [];
  const monthly = all.find((plan) => plan.tier === 'pro' && plan.period === 'month');
  const annual = all.find((plan) => plan.tier === 'pro' && plan.period === 'year');
  // Without the price history (on the backend, for now) the next number isn't known, so none is shown.
  const nextVersion = book.data ? Math.max(0, ...book.data.map((v) => v.version)) + 1 : null;
  const current = monthly && annual ? { monthly: monthly.prices, annual: annual.prices } : null;

  return (
    <AdminPage
      title="Plans & pricing"
      subtitle="Plans, quotas, price versions and comped access. Every change is audited."
      actions={
        <>
          <ExternalLink href={STRIPE} className={adminButton.secondary}>
            Open Stripe
          </ExternalLink>
          <IconButton
            icon="Plus"
            disabled={!current}
            onClick={() => current && setOpen({ kind: 'price', start: current })}
            className={adminButton.primary}
          >
            New price version
          </IconButton>
        </>
      }
    >
      {plans.isError && !plans.data ? (
        <StateView
          tone="danger"
          title="Couldn’t load the plans"
          message="Nothing has changed on the plans."
          actionLabel="Try again"
          onAction={() => void plans.refetch()}
        />
      ) : plans.data?.length === 0 ? (
        <AdminCard icon="Users01" title="Plans">
          <CardEmpty
            title="No plans are set up"
            message="There are no prices or quotas to show yet."
          />
        </AdminCard>
      ) : (
        <div className="grid gap-4 @min-[1100px]/admin:grid-cols-3">
          {plans.data
            ? all.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  badge={planBadge(plan, all)}
                  onEditQuotas={() => setOpen({ kind: 'quotas', plan })}
                />
              ))
            : Array.from({ length: 3 }, (_, index) => <PlanCardSkeleton key={index} />)}
        </div>
      )}

      <PriceBookCard
        versions={book.data}
        loading={book.isPending}
        error={book.isError}
        onRetry={() => void book.refetch()}
        onStartFrom={(start) => setOpen({ kind: 'price', start })}
      />

      <CompedAccessCard onGrant={() => setOpen({ kind: 'comp' })} />

      <NoteBar
        icon="CreditCard02"
        tone="info"
        action={
          <ExternalLink
            href={STRIPE}
            className="inline-flex h-9 items-center gap-1.5 rounded-sm text-body-s font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            Open Stripe dashboard
          </ExternalLink>
        }
      >
        Refunds and disputes are handled in Stripe. Changes made there sync back to the subscriber’s
        plan here.
      </NoteBar>

      {open?.kind === 'quotas' && (
        <EditQuotasDialog plan={open.plan} onClose={() => setOpen(null)} />
      )}
      {open?.kind === 'price' && (
        <PriceVersionDialog
          start={open.start}
          nextVersion={nextVersion}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === 'comp' && <GrantCompDialog onClose={() => setOpen(null)} />}
    </AdminPage>
  );
}
