'use client';

import {
  isBlank,
  parseZeroPeriod,
  type ContentEducation,
  type ContentRole,
  type ZeroDate,
  type ZeroResolution,
} from '@nextkin/shared/models';
import { useState, type ReactNode } from 'react';

import { DateRange } from '@/features/editor/components/DateRange';
import { FieldRow, TextField } from '@/features/editor/components/fields';
import { cn } from '@/lib/cn';
import { brandButton } from '@/ui/brandButton';
import { outlineButton } from '@/ui/outlineButton';
import { StableLabel } from '@/ui/StableLabel';

/**
 * ZERO 04's three questions on the web (toreview §125): a guessed role, skill or education entry,
 * each saved as the real fact (which confirms it when nothing changed) or removed, which resolves
 * it as surely (V2 §7.9). Blanks like "[Company Name]" must be filled before a save.
 */

type FormProps = { busy: boolean; error?: string; onResolve: (resolution: ZeroResolution) => void };

const GUESS = 'Our guess — change it if it’s wrong.';
const errorText = (text?: string) =>
  text ? <span className="text-danger-600">{text}</span> : undefined;
const FormError = ({ text }: { text?: string }) =>
  text ? (
    <p role="alert" className="text-body-s text-danger-600">
      {' '}
      {text}{' '}
    </p>
  ) : null;

const monthOf = (date: ZeroDate) => `${date.year}-${String(date.month ?? 1).padStart(2, '0')}`;
const dateOf = (month: string): ZeroDate => {
  const [year, m] = month.split('-').map(Number);
  return { year: year ?? new Date().getFullYear(), ...(m ? { month: m } : {}) };
};

/** The guessed span as the month fields hold it: "2021-03" to "present" (`null`). */
function useSpan(period: string) {
  const parsed = parseZeroPeriod(period);
  const [span, setSpan] = useState<{ start: string | null; end: string | null }>(() => ({
    start: parsed ? monthOf(parsed.start) : null,
    end: parsed && parsed.end !== 'present' ? monthOf(parsed.end) : null,
  }));
  const resolved = span.start
    ? { start: dateOf(span.start), end: span.end ? dateOf(span.end) : ('present' as const) }
    : null;
  return { span, setSpan, resolved };
}

function Actions({
  busy,
  removeLabel,
  onSave,
  onRemove,
}: {
  busy: boolean;
  removeLabel: string;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 pt-1">
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        className={cn(brandButton, 'h-control-lg rounded-md px-5 text-body-l font-semibold')}
      >
        <StableLabel label="Save answer" busyLabel="Saving…" busy={busy} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        className={cn(outlineButton, 'h-control-lg rounded-md px-5 text-body-l font-semibold')}
      >
        {removeLabel}
      </button>
    </div>
  );
}

function Form({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-title-l font-semibold text-text-primary">{title}</h3>
      {children}
    </div>
  );
}

export function RoleCheckForm({ role, busy, error, onResolve }: FormProps & { role: ContentRole }) {
  const [title, setTitle] = useState(role.title);
  const [company, setCompany] = useState(isBlank(role.company) ? '' : role.company);
  const [tried, setTried] = useState(false);
  const { span, setSpan, resolved } = useSpan(role.period);
  const save = () => {
    setTried(true);
    if (isBlank(title) || isBlank(company) || !resolved) return;
    onResolve({
      kind: 'role',
      roleId: role.id,
      title: title.trim(),
      company: company.trim(),
      ...resolved,
    });
  };
  return (
    <Form title="Is this role right?">
      <FieldRow>
        <TextField
          label="Job title"
          value={title}
          onChange={setTitle}
          hint={
            errorText(tried && isBlank(title) ? 'Add the job title you had.' : undefined) ?? GUESS
          }
          invalid={tried && isBlank(title)}
        />
        <TextField
          label="Company"
          value={company}
          onChange={setCompany}
          placeholder="Company name"
          hint={
            errorText(
              tried && isBlank(company) ? 'Add the real company — a blank can’t stay.' : undefined,
            ) ?? 'Only you know this one.'
          }
          invalid={tried && isBlank(company)}
        />
      </FieldRow>
      <DateRange start={span.start} end={span.end} onChange={setSpan} />
      <FormError text={tried && !resolved ? 'Add when it started.' : error} />
      <Actions
        busy={busy}
        removeLabel="Remove this role"
        onSave={save}
        onRemove={() => onResolve({ kind: 'role', roleId: role.id, remove: true })}
      />
    </Form>
  );
}

export function SkillCheckForm({ skill, busy, error, onResolve }: FormProps & { skill: string }) {
  const [name, setName] = useState(skill);
  const [tried, setTried] = useState(false);
  return (
    <Form title="Do you have this skill?">
      <TextField
        label="Skill"
        value={name}
        onChange={setName}
        hint={errorText(tried && isBlank(name) ? 'Add the skill, or remove it.' : error) ?? GUESS}
        invalid={tried && isBlank(name)}
      />
      <Actions
        busy={busy}
        removeLabel="I don’t have it"
        onSave={() => {
          setTried(true);
          if (!isBlank(name)) onResolve({ kind: 'skill', skill, name: name.trim() });
        }}
        onRemove={() => onResolve({ kind: 'skill', skill, remove: true })}
      />
    </Form>
  );
}

export function EducationCheckForm({
  entry,
  busy,
  error,
  onResolve,
}: FormProps & { entry: ContentEducation }) {
  const [degree, setDegree] = useState(isBlank(entry.degree) ? '' : entry.degree);
  const [school, setSchool] = useState(isBlank(entry.institution) ? '' : entry.institution);
  const [tried, setTried] = useState(false);
  const { span, setSpan, resolved } = useSpan(entry.period);
  const save = () => {
    setTried(true);
    if (isBlank(degree) || isBlank(school) || !resolved) return;
    onResolve({
      kind: 'education',
      entryId: entry.id,
      degree: degree.trim(),
      institution: school.trim(),
      ...resolved,
    });
  };
  return (
    <Form title="Where did you study?">
      <FieldRow>
        <TextField
          label="Degree"
          value={degree}
          onChange={setDegree}
          placeholder="Degree"
          hint={errorText(tried && isBlank(degree) ? 'Add your real degree.' : undefined)}
          invalid={tried && isBlank(degree)}
        />
        <TextField
          label="School"
          value={school}
          onChange={setSchool}
          placeholder="School or university"
          hint={errorText(tried && isBlank(school) ? 'Add the real school.' : undefined)}
          invalid={tried && isBlank(school)}
        />
      </FieldRow>
      <DateRange start={span.start} end={span.end} onChange={setSpan} />
      <FormError text={tried && !resolved ? 'Add when you started.' : error} />
      <Actions
        busy={busy}
        removeLabel="Remove this entry"
        onSave={save}
        onRemove={() => onResolve({ kind: 'education', entryId: entry.id, remove: true })}
      />
    </Form>
  );
}
