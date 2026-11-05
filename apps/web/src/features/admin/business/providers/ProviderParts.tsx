'use client';

import { useId, useState } from 'react';

import { smoothPath } from '@/features/insights/insightsLibrary';
import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { colors } from '@/theme/tokens';

import type { AdminJobProvider } from '@nextkin/shared/models';
import { useSetProviderCeiling, useSetProviderKey } from '@nextkin/shared/queries';

import { formatCount } from '../../format';
import { AdminDialog } from '../../ui/AdminDialog';
import { FieldLabel, TextField } from '../../ui/AdminForm';

/** The board's error-rate line (Figma 408:3766): 160×36, no fill, coloured by how it's going. */
const W = 160;
const H = 36;

export function ErrorSparkline({
  values,
  tone,
}: {
  values: readonly number[];
  tone: 'warning' | 'success' | 'neutral';
}) {
  if (values.length < 2) return <span aria-hidden className="h-9 w-40" />;
  const max = Math.max(...values, 0.0001);
  const min = Math.min(...values);
  const span = max - min || max;
  const points = values.map((value, index) => ({
    x: 1 + (index / (values.length - 1)) * (W - 2),
    // A flat, healthy line sits low and calm; a rising one climbs the box.
    y: H - 4 - ((value - min) / span) * (H - 10) * (tone === 'warning' ? 1 : 0.35),
  }));
  const ink =
    tone === 'warning'
      ? colors.warning600
      : tone === 'success'
        ? colors.success600
        : colors.neutral400;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      className="h-9 w-40 shrink-0 overflow-visible"
      fill="none"
    >
      <path
        d={smoothPath(points)}
        stroke={ink}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        className="animate-line-draw"
      />
    </svg>
  );
}

/**
 * The daily call ceiling (Figma 408:3766's "Daily ceiling"): a number with "calls" after it. It
 * saves when it is left or Enter is pressed, and only if it changed.
 */
export function CeilingField({ provider }: { provider: AdminJobProvider }) {
  const id = useId();
  const save = useSetProviderCeiling();
  const current = provider.quota.ceiling;
  // Shown with separators, as the board writes it ("10,000"); typed either way.
  const shown = (value: number | null) => (value === null ? '' : formatCount(value));
  const [draft, setDraft] = useState(shown(current));
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setDraft(shown(current));
  }
  const blank = draft.trim() === '';
  // An unset ceiling left blank is not an error; there is just nothing to save.
  const valid = /^\d+$/.test(draft.replace(/,/g, '')) || (blank && current === null);

  const commit = () => {
    const next = Number(draft.replace(/,/g, ''));
    if (save.isPending || blank || !valid || next === current) return;
    save.mutate(
      { provider: provider.provider, dailyCalls: next },
      {
        onSuccess: () => {
          setDraft(formatCount(next));
          showToast(`${provider.label}’s daily ceiling is ${formatCount(next)} calls`);
        },
        onError: (error) => {
          setDraft(shown(current));
          showToast(error instanceof Error ? error.message : 'That didn’t save.', {
            tone: 'error',
          });
        },
      },
    );
  };

  return (
    <div className="flex w-[180px] shrink-0 flex-col gap-1.5">
      <FieldLabel htmlFor={id}>Daily ceiling</FieldLabel>
      <div
        className={cn(
          'flex h-11 items-center gap-2 rounded-sm border bg-surface-card px-3.5 shadow-xs transition-[border-color,box-shadow] duration-fast ease-standard focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100',
          valid ? 'border-neutral-300' : 'border-danger-600',
        )}
      >
        <input
          id={id}
          inputMode="numeric"
          value={draft}
          aria-label={`${provider.label} daily ceiling`}
          aria-invalid={valid ? undefined : true}
          aria-describedby={valid ? undefined : `${id}-error`}
          // Stays focusable while it saves (a disabled field drops focus to the page); `commit`
          // ignores a second save until the first is answered.
          aria-busy={save.isPending || undefined}
          readOnly={save.isPending}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
          className="min-w-0 flex-1 bg-transparent text-body-m tabular-nums text-text-primary outline-none"
        />
        <span className="text-body-m text-text-tertiary">calls</span>
      </div>
      {!valid && (
        <p id={`${id}-error`} role="alert" className="text-body-s text-danger-600">
          A whole number of calls.
        </p>
      )}
    </div>
  );
}

/**
 * A new key for a provider. Write-only: the field is a password field, the key goes straight to
 * the server and nothing on this page can show it again (Figma 408:4017).
 */
export function KeyDialog({
  provider,
  onClose,
}: {
  provider: AdminJobProvider;
  onClose: () => void;
}) {
  const save = useSetProviderKey();
  const [key, setKey] = useState('');
  const verb = provider.key.set ? 'Replace' : 'Add';

  return (
    <AdminDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon="Key01"
      tone="brand"
      title={`${verb} the ${provider.label} key`}
      description="Paste the new key. It’s stored write-only: once saved, nobody can see it again, you included. The change is recorded in the audit log, the key isn’t."
      confirm={{
        label: 'Save key',
        disabled: key.trim().length < 8,
        busy: save.isPending,
        onConfirm: () =>
          save.mutate(
            { provider: provider.provider, key: key.trim() },
            {
              onSuccess: () => {
                setKey('');
                showToast(`${provider.label} key saved`);
                onClose();
              },
              onError: (error) =>
                showToast(error instanceof Error ? error.message : 'That didn’t save.', {
                  tone: 'error',
                }),
            },
          ),
      }}
    >
      <TextField
        label="API key"
        required
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={key}
        onChange={(event) => setKey(event.target.value)}
        hint="It replaces the current key as soon as you save."
      />
    </AdminDialog>
  );
}
