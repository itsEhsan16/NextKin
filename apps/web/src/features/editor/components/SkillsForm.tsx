'use client';

import type { DocSkillGroup } from '@nextkin/shared/models';
import { useState } from 'react';

import { PlusIcon, TrashIcon } from '@/ui/icons';
import { XClose } from '@/ui/lineIcons';

import { newId } from '../editorModel';
import { removeButton, toolIcon } from './controls';

/**
 * Skills (toreview §124): one list, or labelled lines the page prints as "Languages: Go, SQL".
 * Type a skill and press Enter or a comma; Backspace in an empty box takes the last one back.
 */

function ChipInput({
  label,
  values,
  onChange,
  max,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...values];
    for (const part of parts)
      if (next.length < max && !next.some((v) => v.toLowerCase() === part.toLowerCase()))
        next.push(part.slice(0, 120));
    onChange(next);
    setDraft('');
  };
  return (
    <div className="flex min-h-control-md w-full min-w-0 flex-wrap items-center gap-1.5 rounded-md border border-border-default bg-surface-card p-1.5 transition-colors duration-press ease-standard focus-within:border-border-brand-strong">
      {values.map((value) => (
        <span
          key={value}
          className="flex items-center gap-1 rounded-sm bg-surface-brand-strong py-1 pl-2.5 pr-1 text-body-s text-text-primary"
        >
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => onChange(values.filter((v) => v !== value))}
            className="flex size-4 items-center justify-center rounded-full text-text-tertiary transition-colors duration-press ease-standard hover:bg-surface-card hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <XClose aria-hidden className={toolIcon} />
          </button>
        </span>
      ))}
      <input
        aria-label={label}
        value={draft}
        disabled={values.length >= max}
        placeholder={values.length ? 'Add another' : 'Type a skill, then Enter'}
        onChange={(event) => {
          const text = event.target.value;
          if (text.includes(',')) add(text);
          else setDraft(text);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add(draft);
          } else if (event.key === 'Backspace' && draft === '' && values.length)
            onChange(values.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
        className="h-7 min-w-[8rem] flex-1 bg-transparent px-1.5 text-body-m text-text-primary outline-none placeholder:text-text-tertiary"
      />
    </div>
  );
}

export function SkillsForm({
  skills,
  onChange,
}: {
  skills: { groups: DocSkillGroup[]; loose: string[] };
  onChange: (skills: { groups: DocSkillGroup[]; loose: string[] }, key: string) => void;
}) {
  const setGroup = (index: number, patch: Partial<DocSkillGroup>, key: string) =>
    onChange(
      { ...skills, groups: skills.groups.map((g, i) => (i === index ? { ...g, ...patch } : g)) },
      `skills.${skills.groups[index]?.id}.${key}`,
    );
  return (
    <div className="flex flex-col gap-3">
      {skills.groups.map((group, index) => (
        <div key={group.id} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <input
              aria-label={`Skill group ${index + 1} label`}
              value={group.label}
              maxLength={80}
              placeholder="Label, e.g. Languages"
              onChange={(event) => setGroup(index, { label: event.target.value }, 'label')}
              className="h-8 min-w-0 flex-1 rounded-md border border-transparent px-2 text-body-m font-semibold text-text-primary hover:border-border-default focus-visible:border-border-brand focus-visible:outline-none"
            />
            <button
              type="button"
              aria-label={`Remove the ${group.label || 'unnamed'} group`}
              onClick={() =>
                onChange(
                  { ...skills, groups: skills.groups.filter((_, i) => i !== index) },
                  'skills.groups',
                )
              }
              className={removeButton}
            >
              <TrashIcon aria-hidden className={toolIcon} />
            </button>
          </div>
          <ChipInput
            label={`${group.label || 'Group'} skills`}
            values={group.skills}
            max={40}
            onChange={(values) => setGroup(index, { skills: values }, 'skills')}
          />
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        {skills.groups.length > 0 && (
          <span className="px-2 text-body-m font-semibold text-text-primary">Other skills</span>
        )}
        <ChipInput
          label="Skills"
          values={skills.loose}
          max={60}
          onChange={(loose) => onChange({ ...skills, loose }, 'skills.loose')}
        />
      </div>
      {skills.groups.length < 12 && (
        <button
          type="button"
          onClick={() =>
            onChange(
              { ...skills, groups: [...skills.groups, { id: newId('g'), label: '', skills: [] }] },
              'skills.groups',
            )
          }
          className="flex h-8 items-center gap-1.5 self-start rounded-md px-2 text-body-s font-semibold text-text-secondary transition-colors duration-press ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <PlusIcon aria-hidden className="size-3.5" />
          Add a labelled line (e.g. “Languages”)
        </button>
      )}
    </div>
  );
}
