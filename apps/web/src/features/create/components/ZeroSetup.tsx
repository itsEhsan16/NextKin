'use client';

import { ZERO_YEARS, ZERO_YEARS_LABEL, type ZeroYears } from '@nextkin/shared/models';
import {
  useCurrentUser,
  useJob,
  useStartGeneration,
  useSubscription,
} from '@nextkin/shared/queries';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useId, useState } from 'react';

import {
  backButton,
  FlowFooter,
  primaryButton,
  StepHeading,
  stepCard,
} from '@/features/create/jobFlow/FlowChrome';
import { cn } from '@/lib/cn';
import { Callout } from '@/ui/Callout';
import { fieldBox } from '@/ui/fieldBox';
import { SparkleIllustration } from '@/ui/illustrations';
import { StableLabel } from '@/ui/StableLabel';

import {
  allowanceNote,
  fullNameOf,
  generationAllowance,
  NAME_MAX,
  ROLE_MAX,
  START_FAILED,
  validateZeroAbout,
  zeroSeedFrom,
  type ZeroAbout,
} from '../createLibrary';

const yearsLabel = (y: ZeroYears) => (y === 'none' ? 'Under 1 yr' : `${ZERO_YEARS_LABEL[y]} yrs`);

function TextInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
  error,
  max,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  max: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline gap-1.5">
        <span className="text-body-m font-semibold text-text-primary">{label}</span>
        {hint && <span className="text-body-s font-medium text-text-tertiary">{hint}</span>}
      </label>
      <input
        id={id}
        value={value}
        maxLength={max + 20}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          fieldBox,
          'h-control-lg px-3.5 text-body-l font-medium placeholder:font-normal placeholder:text-text-tertiary',
          error && 'border-danger-600',
        )}
      />
      {error && <p className="text-body-s text-danger-600">{error}</p>}
    </div>
  );
}

/**
 * ZERO 01 (861:2), step 1: tell us the basics — the name, the years, the role you want — then
 * "Write my first draft" (V2 §7.9). Opened from a job, the role starts as its title. The cap sits
 * in the bar over the button that spends it (§13.5).
 */
export function ZeroSetup({
  role,
  jobId,
  onStarted,
}: {
  role?: string;
  jobId?: string;
  onStarted: (runId: string) => void;
}) {
  const user = useCurrentUser();
  const job = useJob(jobId ?? '');
  const subscription = useSubscription();
  const start = useStartGeneration();
  const yearsId = useId();
  // What the reader typed; until then a field shows its prefill, so a late prefill never types over an edit.
  const [edits, setEdits] = useState<Partial<ZeroAbout>>({});
  const [refused, setRefused] = useState(false);
  const title = job.data?.title ?? role;
  const about: ZeroAbout = {
    fullName: edits.fullName ?? (user.data ? fullNameOf(user.data) : ''),
    role: edits.role ?? title ?? '',
    years: edits.years ?? null,
  };
  const errors = refused ? validateZeroAbout(about) : {};
  const allowance = generationAllowance(subscription.data?.usage);

  const write = () => {
    if (Object.keys(validateZeroAbout(about)).length > 0) return setRefused(true);
    start.mutate(
      { kind: 'zero_resume', zero: zeroSeedFrom(about), ...(jobId ? { jobId } : {}) },
      { onSuccess: (g) => onStarted(g.id) },
    );
  };

  const note = start.isError
    ? START_FAILED
    : allowance.spent
      ? allowanceNote(allowance, 'generation', 'generations')
      : 'Nothing is saved until you’ve checked the draft.';
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="zero-basics" className={stepCard}>
        <div className="border-b border-border-default px-8 pb-5 pt-6">
          <StepHeading
            id="zero-basics"
            step={1}
            of={4}
            title="Tell us the basics"
            lede="Three answers are enough for a first draft. We mark every guess so you can check it before anything is saved."
          />
        </div>
        <div className="flex items-center gap-10 px-8 pb-7 pt-6">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <TextInput
              label="Your name"
              value={about.fullName}
              onChange={(v) => setEdits((e) => ({ ...e, fullName: v }))}
              max={NAME_MAX}
              {...(errors.fullName ? { error: errors.fullName } : {})}
            />
            <div className="flex flex-col gap-2">
              <p id={yearsId} className="text-body-m font-semibold text-text-primary">
                Years of experience
              </p>
              <div role="radiogroup" aria-labelledby={yearsId} className="grid grid-cols-5 gap-2.5">
                {ZERO_YEARS.map((y) => {
                  const on = about.years === y;
                  return (
                    <button
                      key={y}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setEdits((e) => ({ ...e, years: y }))}
                      className={cn(
                        'h-control-lg rounded-md border text-body-l transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                        on
                          ? 'border-brand-600 bg-surface-brand-strong font-bold text-brand-700 ring-1 ring-brand-600'
                          : cn(
                              'bg-surface-card font-semibold text-neutral-700 hover:border-neutral-400',
                              errors.years ? 'border-danger-600' : 'border-border-default',
                            ),
                      )}
                    >
                      {yearsLabel(y)}
                    </button>
                  );
                })}
              </div>
              {errors.years && <p className="text-body-s text-danger-600">{errors.years}</p>}
            </div>
            <TextInput
              label="The role you want"
              {...(job.data?.company ? { hint: `From ${job.data.company}’s job` } : {})}
              value={about.role}
              onChange={(v) => setEdits((e) => ({ ...e, role: v }))}
              placeholder="e.g. Product Designer"
              max={ROLE_MAX}
              {...(errors.role ? { error: errors.role } : {})}
            />
            <Callout>
              Anything we can’t know (dates, numbers, names) stays a [blank] for you to fill in.
            </Callout>
          </div>
          <Image
            src="/illustrations/flow/zero.png"
            alt=""
            width={380}
            height={280}
            className="hidden h-auto w-96 shrink-0 object-contain lg:block"
          />
        </div>
      </section>
      <FlowFooter note={note} noteTone={start.isError ? 'danger' : 'neutral'}>
        <Link href={'/' as Route} className={backButton}>
          Back
        </Link>
        {allowance.spent ? (
          <Link href={'/upgrade' as Route} className={primaryButton}>
            See Pro plans
          </Link>
        ) : (
          <button
            type="button"
            onClick={write}
            disabled={user.isPending || start.isPending}
            className={primaryButton}
          >
            <SparkleIllustration aria-hidden className="h-auto w-4" />
            <StableLabel
              label="Write my first draft"
              busyLabel="Starting…"
              busy={start.isPending}
            />
          </button>
        )}
      </FlowFooter>
    </div>
  );
}
