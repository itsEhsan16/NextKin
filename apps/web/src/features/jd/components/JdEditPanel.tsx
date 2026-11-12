'use client';

import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  type EmploymentType,
  type ExperienceLevel,
  type JdDraft,
  type JdDraftPatch,
} from '@nextkin/shared/models';
import { useUpdateJdDraft } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';

import { buttonClass } from '@/ui/Button';
import { cardSurface } from '@/ui/Card';
import { cn } from '@/lib/cn';
import { Callout } from '@/ui/Callout';
import { formatRelativeTime } from '@/lib/format';
import { showToast } from '@/lib/toast';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { fieldBox } from '@/ui/fieldBox';
import { iconButton } from '@/ui/iconButton';
import { LocationPinIcon, PlusIcon, TrashIcon } from '@/ui/icons';
import { ChevronRight } from '@/ui/lineIcons';
import { JdArtDocumentSearchIllustration } from '@/ui/illustrations';
import { SelectField } from '@/ui/SelectField';
import { StableLabel } from '@/ui/StableLabel';

import { SkillListField } from './SkillListField';

const LEVELS = Object.keys(EXPERIENCE_LEVEL_LABEL) as ExperienceLevel[];
const TYPES = Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[];
const label = 'text-body-l font-medium text-text-primary';

function Field({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="flex items-baseline gap-2">
        <span className={label}>{title}</span>
        {hint && <span className="text-body-s font-medium text-text-tertiary">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  aria,
  trailing,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  aria: string;
  trailing?: ReactNode;
}) {
  return (
    <span
      className={cn(
        fieldBox,
        'h-control-lg gap-2 px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600',
      )}
    >
      <input
        aria-label={aria}
        value={value}
        maxLength={200}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-body-l outline-none placeholder:text-text-tertiary"
      />
      {trailing}
    </span>
  );
}

/**
 * W-FLOW 06 (860:6), V2 §7.5's review: everything we read from the job, to correct — title,
 * company, place, seniority and type, the must-have and nice-to-have skills (moved between the two
 * with a chip's arrow) and the responsibilities — beside the text as it was pasted. What is saved
 * is what tailoring and scoring read; the posting itself never changes.
 */
export function JdEditPanel({
  draft,
  onDone,
  backHref,
}: {
  draft: JdDraft;
  onDone: () => void;
  backHref: Route;
}) {
  const update = useUpdateJdDraft(draft.id);
  const [title, setTitle] = useState(draft.status === 'failed' ? '' : draft.title);
  const [company, setCompany] = useState(draft.company ?? '');
  const [location, setLocation] = useState(draft.location ?? '');
  const [level, setLevel] = useState<ExperienceLevel | null>(draft.experienceLevel ?? null);
  const [type, setType] = useState<EmploymentType | null>(draft.employmentType ?? null);
  const [required, setRequired] = useState<string[]>(draft.requiredSkills);
  const [preferred, setPreferred] = useState<string[]>(draft.preferredSkills);
  const [duties, setDuties] = useState<string[]>(draft.responsibilities);
  const [problem, setProblem] = useState<string | null>(null);
  const formId = useId();
  const failed = draft.status === 'failed';

  const save = () => {
    if (update.isPending) return;
    const kept = duties
      .map((d) => d.trim())
      .filter(Boolean)
      .slice(0, 30);
    if (!title.trim()) return setProblem('Give the job a title.');
    if (failed && !required.length && !preferred.length && !kept.length)
      return setProblem(
        'Add at least one skill or responsibility, so there is something to match.',
      );
    setProblem(null);
    const patch: JdDraftPatch = {
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      ...(level ? { experienceLevel: level } : {}),
      ...(type ? { employmentType: type } : {}),
      requiredSkills: required,
      preferredSkills: preferred,
      responsibilities: kept,
    };
    update.mutate(patch, {
      onSuccess: () => {
        showToast('Details saved.', { tone: 'success' });
        onDone();
      },
      onError: () => showToast('Couldn’t save the details. Try again.', { tone: 'error' }),
    });
  };

  const source =
    draft.source === 'link'
      ? 'Linked job description'
      : draft.source === 'file'
        ? 'Uploaded job description'
        : 'Pasted job description';
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3.5">
        <Link
          href={backHref}
          aria-label="Back to the job description"
          className={cn(
            iconButton,
            'size-10 rounded-full border border-border-subtle bg-surface-card shadow-card',
          )}
        >
          <ChevronRight aria-hidden className="size-4.5 rotate-180 text-text-primary" />
        </Link>
        {draft.company && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-card">
            <CompanyLogo company={draft.company} variant="inline" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-caption-m font-medium text-text-tertiary">{source}</p>
          <h1 className="text-h1 font-bold tracking-tight text-text-primary">Edit details</h1>
        </div>
        {!failed && (
          <button
            type="button"
            onClick={onDone}
            className={buttonClass({ variant: 'secondary', size: 'lg' })}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          form={formId}
          disabled={update.isPending}
          aria-busy={update.isPending}
          className={buttonClass({ size: 'lg' })}
        >
          <StableLabel label="Save changes" busyLabel="Saving…" busy={update.isPending} />
        </button>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <form
          id={formId}
          aria-label="Edit the job’s details"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className={cn(cardSurface, 'flex flex-col gap-6 rounded-xl p-8 lg:col-span-2')}
        >
          <div className="flex items-center gap-3.5">
            <JdArtDocumentSearchIllustration aria-hidden className="h-auto w-11 shrink-0" />
            <div>
              <h2 className="text-title-l font-bold text-text-primary">
                What we read from the job
              </h2>
              <p className="text-body-m text-text-secondary">
                {failed
                  ? 'We couldn’t read this as a job description. Enter its details yourself — the text is on the right.'
                  : 'Fix anything we got wrong. We compare your resume with what’s here.'}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field title="Job title">
              <Input
                aria="Job title"
                value={title}
                onChange={setTitle}
                placeholder="Software Engineer"
              />
            </Field>
            <Field title="Company">
              <Input
                aria="Company"
                value={company}
                onChange={setCompany}
                placeholder="Not stated"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field title="Location">
              <Input
                aria="Location"
                value={location}
                onChange={setLocation}
                placeholder="Not stated"
                trailing={
                  <LocationPinIcon aria-hidden className="size-4 shrink-0 text-text-tertiary" />
                }
              />
            </Field>
            <Field title="Seniority">
              <SelectField
                label="Seniority"
                value={level}
                placeholder="Not stated"
                options={LEVELS}
                labelOf={(v) => EXPERIENCE_LEVEL_LABEL[v]}
                onChange={setLevel}
                className="h-control-lg"
              />
            </Field>
            <Field title="Employment type">
              <SelectField
                label="Employment type"
                value={type}
                placeholder="Not stated"
                options={TYPES}
                labelOf={(v) => EMPLOYMENT_TYPE_LABEL[v]}
                onChange={setType}
                className="h-control-lg"
              />
            </Field>
          </div>
          <Field title="Must-have skills" hint="Weighed twice">
            <SkillListField
              label="Must-have skills"
              values={required}
              onChange={setRequired}
              move={{
                label: 'Move to nice to have',
                onMove: (s) => {
                  setRequired((l) => l.filter((x) => x !== s));
                  setPreferred((l) => [...l, s]);
                },
              }}
            />
          </Field>
          <Field title="Nice to have" hint="Weighed once">
            <SkillListField
              label="Nice to have"
              values={preferred}
              onChange={setPreferred}
              move={{
                label: 'Move to must-have',
                onMove: (s) => {
                  setPreferred((l) => l.filter((x) => x !== s));
                  setRequired((l) => [...l, s]);
                },
              }}
            />
          </Field>
          <Field title="Responsibilities">
            <ul className="flex flex-col gap-2.5">
              {duties.map((duty, i) => (
                <li
                  key={i}
                  className={cn(
                    fieldBox,
                    'h-auto min-h-control-lg gap-2 px-3.5 py-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600',
                  )}
                >
                  <input
                    aria-label={`Responsibility ${i + 1}`}
                    value={duty}
                    maxLength={400}
                    onChange={(e) =>
                      setDuties((d) => d.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    className="min-w-0 flex-1 bg-transparent text-body-l outline-none"
                  />
                  <button
                    type="button"
                    aria-label={`Remove responsibility ${i + 1}`}
                    onClick={() => setDuties((d) => d.filter((_, j) => j !== i))}
                    className="rounded-sm text-text-tertiary hover:text-danger-600 focus-visible:outline-2 focus-visible:outline-brand-600"
                  >
                    <TrashIcon aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setDuties((d) => [...d, ''])}
              className="flex items-center gap-1.5 self-start rounded-sm text-body-m font-semibold text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <PlusIcon aria-hidden className="size-3.5" />
              Add a responsibility
            </button>
          </Field>
          {problem && (
            <p role="alert" className="text-body-m text-danger-600">
              {problem}
            </p>
          )}
        </form>

        <aside
          aria-label="The text as it was given"
          className={cn(cardSurface, 'flex flex-col gap-4 rounded-xl p-6 lg:sticky lg:top-6')}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-title-l font-bold text-text-primary">
              {draft.source === 'paste' ? 'The text you pasted' : 'The text we read'}
            </h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-caption-m font-medium text-text-secondary">
              Read {formatRelativeTime(draft.createdAt).toLowerCase()}
            </span>
          </div>
          <p className="max-h-120 overflow-y-auto whitespace-pre-line rounded-md bg-neutral-50 p-4 text-body-m text-text-secondary">
            {draft.rawText}
          </p>
          <Callout>Changes here update the comparison. They don’t change the posting.</Callout>
        </aside>
      </div>
    </div>
  );
}
