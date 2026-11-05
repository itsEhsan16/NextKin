'use client';

import { useState } from 'react';

import type { Technology } from '@nextkin/shared/models';
import { useSaveTechnology } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { TextField } from '../../ui/AdminForm';
import { errorMessage } from '../format';
import { dateError, sourceError, toStoredDate, toTypedDate } from './releaseDate';

/**
 * Add a technology, or edit one (Figma 409:1872 "Add technology", a row's Edit). Nothing is
 * published from here: the entry goes to the review queue. A release date needs a cited source
 * that is a web address, as approving it will (P12-04). A missing field is named when the button is
 * pressed or the field is left, never by a silently disabled button.
 */
export function TechnologyDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Technology | null;
}) {
  const save = useSaveTechnology();
  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [aliases, setAliases] = useState(editing?.aliases.join(', ') ?? '');
  const [version, setVersion] = useState(editing?.latestVersion ?? '');
  const [date, setDate] = useState(toTypedDate(editing?.releaseDate ?? null));
  const [source, setSource] = useState(editing?.sourceUrl ?? '');
  const [touched, setTouched] = useState<{ name?: boolean; category?: boolean }>({});

  const nameError = touched.name && !name.trim() ? 'Give it a name.' : undefined;
  const categoryError = touched.category && !category.trim() ? 'Give it a category.' : undefined;
  const dateProblem = dateError(date);
  const sourceProblem = sourceError(date, source);
  const complete = name.trim() && category.trim() && !dateProblem && !sourceProblem;

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={editing ? 'Edit03' : 'Plus'}
      tone="brand"
      title={editing ? `Edit ${editing.name}` : 'Add technology'}
      description="The change goes to the review queue; it reaches resumes and jobs once it's approved."
      confirm={{
        label: editing ? 'Send for review' : 'Add to review queue',
        busy: save.isPending,
        onConfirm: () => {
          setTouched({ name: true, category: true });
          if (!complete) return;
          save.mutate(
            {
              input: {
                name: name.trim(),
                category: category.trim(),
                aliases: aliases
                  .split(',')
                  .map((a) => a.trim())
                  .filter(Boolean),
                latestVersion: version.trim() || null,
                releaseDate: toStoredDate(date),
                sourceUrl: source.trim() || null,
              },
              ...(editing ? { id: editing.id } : {}),
            },
            {
              onSuccess: (tech) => {
                showToast(`${tech.name} is in the review queue`);
                onOpenChange(false);
              },
              onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
            },
          );
        },
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          placeholder="Next.js"
          error={nameError}
        />
        <TextField
          label="Category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, category: true }))}
          placeholder="Frontend framework"
          error={categoryError}
        />
        <div className="col-span-2">
          <TextField
            label="Aliases"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="next, nextjs"
            hint="Separate with commas."
          />
        </div>
        <TextField
          label="Latest version"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="15.1"
        />
        <TextField
          label="Release date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          placeholder="2024-12-10"
          hint="YYYY-MM-DD, or YYYY when only the year is known."
          error={dateProblem}
        />
        <div className="col-span-2">
          <TextField
            label="Cited source"
            required={Boolean(date)}
            type="url"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://nextjs.org/blog/next-15-1"
            hint="Official release notes or the project's own site."
            error={sourceProblem}
          />
        </div>
      </div>
    </AdminDialog>
  );
}
