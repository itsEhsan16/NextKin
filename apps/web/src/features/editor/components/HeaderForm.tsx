'use client';

import type { DocContactItem, DocHeader } from '@nextkin/shared/models';
import { useState } from 'react';

import { ChevronDownIcon, PlusIcon } from '@/ui/icons';
import { XClose } from '@/ui/lineIcons';

import { move, newId } from '../editorModel';
import { FieldRow, TextField } from './fields';
import { cn } from '@/lib/cn';
import { removeButton, toolButton, toolIcon } from './controls';

/**
 * The top of the page (toreview §124): the name, the line under it, and the contact row in print
 * order. An item that says an email, a phone number or a web address is linked by itself; a
 * label ("LinkedIn") can carry its own link.
 */

const QUICK_ADD: { label: string; placeholder: string }[] = [
  { label: 'Email', placeholder: 'you@example.com' },
  { label: 'Phone', placeholder: '+1 555 010 0100' },
  { label: 'Location', placeholder: 'City, Country' },
  { label: 'LinkedIn', placeholder: 'linkedin.com/in/you' },
  { label: 'Website', placeholder: 'yourname.dev' },
];

export function HeaderForm({
  header,
  onChange,
}: {
  header: DocHeader;
  onChange: (header: DocHeader, key: string) => void;
}) {
  // What a quick-added item is for, shown as its placeholder until it is filled.
  const [hints, setHints] = useState<Record<string, string>>({});
  const setItem = (index: number, patch: Partial<DocContactItem>) =>
    onChange(
      {
        ...header,
        items: header.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      },
      `header.item.${header.items[index]?.id}`,
    );

  return (
    <div className="flex flex-col gap-3">
      <FieldRow>
        <TextField
          label="Full name"
          value={header.name}
          maxLength={120}
          invalid={!header.name.trim()}
          hint={!header.name.trim() ? 'Your name goes at the top of the page.' : undefined}
          onChange={(name) => onChange({ ...header, name }, 'header.name')}
          placeholder="Your name"
        />
        <TextField
          label="Headline"
          value={header.headline}
          onChange={(headline) => onChange({ ...header, headline }, 'header.headline')}
          placeholder="e.g. Senior Frontend Engineer"
        />
      </FieldRow>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-body-m font-semibold text-text-primary">Contact row</legend>
        {header.items.length === 0 && (
          <p className="text-body-s text-text-tertiary">
            Add how employers reach you: your email and phone at least.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {header.items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-1.5">
              <input
                aria-label={`Contact ${index + 1}`}
                value={item.text}
                maxLength={200}
                placeholder={hints[item.id] ?? "Email, phone, city or a link's label"}
                onChange={(event) => setItem(index, { text: event.target.value })}
                className="h-control-md min-w-0 flex-1 rounded-md border border-border-default bg-surface-card px-3 text-body-m text-text-primary placeholder:text-text-tertiary hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              />
              <input
                aria-label={`Link for contact ${index + 1}`}
                value={item.url ?? ''}
                maxLength={500}
                placeholder="Link (optional)"
                onChange={(event) => setItem(index, { url: event.target.value || undefined })}
                className="h-control-md w-[38%] min-w-0 rounded-md border border-border-default bg-surface-card px-3 text-body-s text-text-secondary placeholder:text-text-tertiary hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              />
              <button
                type="button"
                aria-label={`Move contact ${index + 1} earlier in the row`}
                disabled={index === 0}
                onClick={() =>
                  onChange({ ...header, items: move(header.items, index, -1) }, 'header.items')
                }
                className={toolButton}
              >
                <ChevronDownIcon aria-hidden className={cn(toolIcon, 'rotate-180')} />
              </button>
              <button
                type="button"
                aria-label={`Remove contact ${index + 1}`}
                onClick={() =>
                  onChange(
                    { ...header, items: header.items.filter((_, i) => i !== index) },
                    'header.items',
                  )
                }
                className={removeButton}
              >
                <XClose aria-hidden className={toolIcon} />
              </button>
            </li>
          ))}
        </ul>
        {header.items.length < 12 && (
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ADD.map((quick) => (
              <button
                key={quick.label}
                type="button"
                onClick={() => {
                  const id = newId('c');
                  setHints((h) => ({ ...h, [id]: quick.placeholder }));
                  onChange(
                    { ...header, items: [...header.items, { id, text: '' }] },
                    'header.items',
                  );
                }}
                title={`Add ${quick.label.toLowerCase()} (${quick.placeholder})`}
                className="flex h-7 items-center gap-1 rounded-full border border-border-default bg-surface-card px-2.5 text-caption-m font-semibold text-text-secondary transition-colors duration-press ease-standard hover:border-border-brand hover:text-text-brand focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <PlusIcon aria-hidden className="size-3" />
                {quick.label}
              </button>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
