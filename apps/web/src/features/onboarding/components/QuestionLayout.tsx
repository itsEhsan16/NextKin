import Link from 'next/link';
import type { Route } from 'next';
import type { FormEvent, ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { ArrowRightIcon } from '@/ui/icons';
import { brandButton } from '@/ui/brandButton';
import { pressable } from '@/ui/pressable';

export type QuestionLayoutProps = {
  /** "WELCOME TO NEXTKIN", "QUESTION 2" (814:2, 814:22). */
  eyebrow: string;
  title: ReactNode;
  /** ONB 02's grey second line, "What are you aiming for?" (814:26). */
  subtitle?: string;
  help: ReactNode;
  children: ReactNode;
  onContinue: () => void;
  canContinue: boolean;
  /** Absent on the first question, which has no Back. */
  back?: Route;
  /** ONB 07's "Create my starting point" (816:169), ONB 08's "Go to my dashboard" (816:234). */
  continueLabel?: string;
  /** ONB 08 draws its button alone: no Enter hint (816:233). */
  hint?: boolean;
  /** Continue full width over the hint (ONB 01), or beside it with Back at the far end. */
  layout?: 'stacked' | 'inline';
};

/**
 * The question column every ONB board shares (807:13): eyebrow, the question, help text, the
 * answer, then Continue with its Enter hint. ONB 01 stacks Continue full width over the hint;
 * the others put the hint beside Continue and Back at the far end. The column is a form, so Enter
 * anywhere in it continues.
 */
export function QuestionLayout({
  eyebrow,
  title,
  subtitle,
  help,
  children,
  onContinue,
  canContinue,
  back,
  continueLabel = 'Continue',
  hint: showHint = true,
  layout = back ? 'inline' : 'stacked',
}: QuestionLayoutProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canContinue) onContinue();
  };

  const hint = (
    <span className="flex items-center gap-1.5 text-body-s font-medium text-text-tertiary">
      or press
      <kbd className="rounded-sm border border-border-default bg-surface-card px-1.5 py-px font-sans text-caption-m font-semibold text-text-secondary">
        Enter ↵
      </kbd>
    </span>
  );

  const continueButton = (
    <button
      type="submit"
      disabled={!canContinue}
      className={cn(
        brandButton,
        'h-control-lg gap-2 rounded-md px-5 text-body-m font-semibold',
        layout === 'stacked' && 'w-full',
      )}
    >
      {continueLabel}
      <ArrowRightIcon className="size-3.5" />
    </button>
  );

  return (
    <form onSubmit={submit} className="flex flex-col animate-reveal">
      <p className="text-micro font-bold uppercase tracking-[0.08em] text-text-brand">{eyebrow}</p>
      <h1 className="mt-2.5 text-hero font-bold text-text-primary">{title}</h1>
      {subtitle && <p className="text-display-l font-semibold text-text-tertiary">{subtitle}</p>}
      <p className="mt-2 text-body-l text-text-secondary">{help}</p>
      <div className="mt-5">{children}</div>
      {layout === 'inline' ? (
        <div className="mt-6 flex items-center gap-3">
          {continueButton}
          {showHint && hint}
          {back && (
            <Link
              href={back}
              className={cn(
                pressable,
                'ml-auto flex h-control-md items-center gap-1.5 rounded-md px-2 text-body-l font-semibold text-text-secondary hover:text-text-primary',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              )}
            >
              <ArrowRightIcon className="size-3.5 rotate-180" />
              Back
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-2.5">
          {continueButton}
          {showHint && hint}
        </div>
      )}
    </form>
  );
}
