'use client';

import { useId, useState, type FormEvent } from 'react';

import type { AdminSettings, AdminSettingsPatch } from '@nextkin/shared/models';
import { isNetwork, networkCovers } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { TextField } from '../../ui/AdminForm';
import { maskIp } from '../trustFormat';

/**
 * Allowed networks (Figma 409:1743): when the list has entries, staff can only sign in from them.
 * The card says whether the address you are on now is covered, and won't remove the last entry
 * that covers it, so nobody locks themselves out from this page.
 */
export function NetworksCard({
  settings,
  onSave,
  saving,
}: {
  settings: AdminSettings;
  onSave: (patch: AdminSettingsPatch, done: string) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState('');
  // What's wrong with the typed address, under the field; and a refused removal, which is about the
  // list rather than the field, as its own line.
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const errorId = useId();
  const list = settings.allowedNetworks;
  // `null` when the server can't see the client's address; nothing then counts as covering it.
  const ip = settings.currentIp;
  const covers = (cidr: string) => ip !== null && networkCovers(cidr, ip);
  const ipLabel = ip ? `Your current IP ${maskIp(ip)}` : 'Your address (the server can’t see it)';
  const covered = list.length === 0 || list.some((entry) => covers(entry.cidr));

  const add = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!isNetwork(value)) {
      setError('Enter an IPv4 address or a CIDR range, like 203.0.113.0/24.');
      return;
    }
    if (list.some((entry) => entry.cidr === value)) {
      setError('That address is already on the list.');
      return;
    }
    // Adding a first entry that doesn't cover this address would lock its author out.
    if (list.length === 0 && !covers(value)) {
      setError(`${ipLabel} isn’t in that range. Add it first, or you’d be locked out.`);
      return;
    }
    setError(null);
    setRefusal(null);
    setDraft('');
    onSave(
      { allowedNetworks: [...list, { cidr: value, label: '' }] },
      `${value} added to allowed networks`,
    );
  };

  const remove = (cidr: string) => {
    const next = list.filter((entry) => entry.cidr !== cidr);
    if (next.length > 0 && !next.some((entry) => covers(entry.cidr))) {
      setRefusal(
        `Removing ${cidr} would lock you out: it is the only entry covering your current IP.`,
      );
      return;
    }
    setRefusal(null);
    onSave({ allowedNetworks: next }, `${cidr} removed from allowed networks`);
  };

  return (
    <AdminCard
      icon="Globe01"
      title="Allowed networks"
      trailing={<AdminBadge tone="neutral">Optional</AdminBadge>}
      bodyClassName="gap-4"
    >
      <p className="text-body-s text-text-secondary">
        When the list has entries, staff can only sign in from these IP addresses or ranges. Leave
        it empty to allow any network.
      </p>
      {/* The error sits under the row, so Add stays level with the input (409:1756). */}
      <form onSubmit={add} noValidate className="flex flex-col gap-1.5">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <TextField
              label="Add an IP address or CIDR range"
              placeholder="e.g. 203.0.113.0/24"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          {/* Full strength at rest, as drawn; an empty field is refused with the format hint. */}
          <AddButton disabled={saving} />
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-body-s text-danger-600">
            {error}
          </p>
        )}
      </form>
      {list.length > 0 && (
        <ul aria-label="Allowed networks" className="flex flex-wrap gap-2">
          {list.map((entry) => (
            <li
              key={entry.cidr}
              className="flex items-center gap-1.5 rounded-[6px] border border-neutral-300 bg-surface-card py-1 pl-2.5 pr-1.5 text-body-s"
            >
              <span className="font-medium text-neutral-700">{entry.cidr}</span>
              {entry.label && <span className="text-text-tertiary">{entry.label}</span>}
              <button
                type="button"
                aria-label={`Remove ${entry.cidr}`}
                disabled={saving}
                onClick={() => remove(entry.cidr)}
                className="relative flex size-4 items-center justify-center rounded-[4px] text-neutral-400 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-brand-600 after:absolute after:-inset-3.5"
              >
                <AdminIcon name="XClose" size="xs" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {refusal && (
        <p role="alert" className="flex items-center gap-1.5 text-body-s text-danger-600">
          <AdminIcon name="AlertTriangle" size="sm" />
          {refusal}
        </p>
      )}
      <p
        role="status"
        className={cn(
          'flex items-center gap-1.5 text-body-s',
          covered ? 'text-text-secondary' : 'text-warning-600',
        )}
      >
        <AdminIcon
          name={covered ? 'CheckCircle' : 'AlertTriangle'}
          size="sm"
          className={covered ? 'text-success-600' : undefined}
        />
        {list.length === 0
          ? 'The list is empty, so staff can sign in from any network.'
          : covered
            ? `${ipLabel} is on the list, so you won’t be locked out.`
            : `${ipLabel} isn’t on the list.`}
      </p>
    </AdminCard>
  );
}

function AddButton({ disabled }: { disabled: boolean }) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button type="submit" disabled={disabled} {...hoverProps} className={adminButton.secondary}>
      <AdminIcon ref={iconRef} name="Plus" />
      Add
    </button>
  );
}
