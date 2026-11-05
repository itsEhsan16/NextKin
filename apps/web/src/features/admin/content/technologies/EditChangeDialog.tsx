'use client';

import { useState } from 'react';

import type { KbChange } from '@nextkin/shared/models';
import { useEditChange } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { TextField } from '../../ui/AdminForm';
import { errorMessage } from '../format';
import { changeDateToTyped, dateError, sourceError, toStoredDate } from './releaseDate';

type Proposed = { field: string; from: string | null; to: string | null };

const DATE_FIELD = 'Release date';

/**
 * Edit the proposed values before deciding; the change becomes a staff edit (410:1771 "Edit"). A
 * change to a release date also takes its cited source here, since approving the date needs one.
 */
export function EditChangeDialog({
  change,
  open,
  onOpenChange,
}: {
  change: KbChange;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const edit = useEditChange();
  const fields = change.detail.fields.filter((f): f is Proposed => 'to' in f);
  const touchesDate = fields.some((f) => f.field === DATE_FIELD);
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      fields.map((f) => [f.field, f.field === DATE_FIELD ? changeDateToTyped(f.to) : (f.to ?? '')]),
    ),
  );
  const [source, setSource] = useState(() => {
    const url = change.detail.source?.url;
    return url ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : '';
  });

  const date = values[DATE_FIELD] ?? '';
  const dateProblem = touchesDate ? dateError(date) : undefined;
  const sourceProblem = touchesDate ? sourceError(date, source) : undefined;
  const editable = fields.length > 0;

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="Edit03"
      tone="brand"
      title={`Edit ${change.title}`}
      description="Your values replace the proposed ones. The change stays in the queue for a decision."
      confirm={{
        label: 'Save changes',
        disabled: !editable || Boolean(dateProblem) || Boolean(sourceProblem),
        busy: edit.isPending,
        onConfirm: () =>
          edit.mutate(
            {
              id: change.id,
              fields: Object.entries(values).map(([field, to]) => ({
                field,
                to: field === DATE_FIELD ? (toStoredDate(to) ?? '') : to,
              })),
              ...(touchesDate ? { source: source.trim() || null } : {}),
            },
            {
              onSuccess: () => {
                showToast('Change updated');
                onOpenChange(false);
              },
              onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
            },
          ),
      }}
    >
      {!editable ? (
        <p className="text-body-s text-text-secondary">This change has no editable values.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {fields.map((field) => (
            <TextField
              key={field.field}
              label={field.field}
              value={values[field.field] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.field]: e.target.value }))}
              {...(field.field === DATE_FIELD ? { placeholder: '2024-12-10' } : {})}
              hint={
                field.field === DATE_FIELD
                  ? 'YYYY-MM-DD, or YYYY when only the year is known.'
                  : field.from
                    ? `Currently ${field.from}`
                    : 'New value'
              }
              error={field.field === DATE_FIELD ? dateProblem : undefined}
            />
          ))}
          {touchesDate && (
            <TextField
              label="Cited source"
              required
              type="url"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://nextjs.org/blog/next-15-1"
              hint="Official release notes or the project's own site."
              error={sourceProblem}
            />
          )}
        </div>
      )}
    </AdminDialog>
  );
}
