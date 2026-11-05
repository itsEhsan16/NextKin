'use client';

import { useState } from 'react';

import type { KbChange } from '@nextkin/shared/models';
import { useDecideChange } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';

import { AdminCard } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { errorMessage } from '../format';
import { ActionButton, InfoAlert } from '../ui/ContentBits';
import { EditChangeDialog } from './EditChangeDialog';
import { FieldChanges } from './FieldChanges';
import { ChangeSummary, UserReports } from './ReviewParts';

/**
 * The change in focus on the review queue (Figma 410:1771): its summary, field changes, user
 * reports, the cited-source rule, and the decision bar. Approve is held for a date change with no
 * cited source; Edit replaces the proposed values before a decision.
 */
export function ReviewDetails({
  change,
  position,
  total,
  onStep,
  onDecided,
}: {
  change: KbChange;
  position: number;
  total: number;
  onStep: (step: 1 | -1) => void;
  onDecided: () => void;
}) {
  const decide = useDecideChange();
  const [editing, setEditing] = useState(false);
  const datesChange = change.detail.fields.some(
    (f) => f.field === 'Release date' && 'to' in f && f.to,
  );
  const cited = Boolean(change.detail.source?.cited);
  const host = change.detail.source?.url.replace(/^https?:\/\//, '').split('/')[0];

  const act = (decision: 'approve' | 'reject') =>
    decide.mutate(
      { id: change.id, decision },
      {
        onSuccess: () => {
          showToast(
            decision === 'approve' ? `Approved: ${change.title}` : `Rejected: ${change.title}`,
          );
          onDecided();
        },
        onError: (error) => showToast(errorMessage(error), { tone: 'error' }),
      },
    );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AdminCard
        icon="File06"
        title="Change details"
        trailing={
          <div className="flex items-center gap-2">
            <span className="text-caption-m font-normal text-text-tertiary">
              {position} of {total}
            </span>
            <StepButton
              icon="ArrowUp"
              label="Previous change"
              disabled={position <= 1}
              onClick={() => onStep(-1)}
            />
            <StepButton
              icon="ArrowDown"
              label="Next change"
              disabled={position >= total}
              onClick={() => onStep(1)}
            />
          </div>
        }
      >
        <ChangeSummary change={change} />
      </AdminCard>
      <FieldChanges change={change} />
      <UserReports change={change} />
      {datesChange && (
        <InfoAlert title="Dates need a cited source">
          Approving a release date needs a cited source.{' '}
          {cited
            ? `This change cites ${host}, so it can be approved.`
            : 'This change has no cited source yet, so edit it to add one before approving.'}
        </InfoAlert>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 bg-surface-card py-3.5 pl-5 pr-4 shadow-xs">
        <p className="flex flex-1 items-center gap-3 text-body-s text-text-secondary">
          <AdminIcon name="ShieldTick" className="text-neutral-500" />
          Your decision is written to the audit log with this change.
        </p>
        <ActionButton onClick={() => act('reject')} disabled={decide.isPending}>
          Reject
        </ActionButton>
        <ActionButton icon="Edit03" onClick={() => setEditing(true)} disabled={decide.isPending}>
          Edit
        </ActionButton>
        <ActionButton
          variant="primary"
          icon="Check"
          onClick={() => act('approve')}
          busy={decide.isPending && decide.variables?.decision === 'approve'}
          disabled={datesChange && !cited}
        >
          Approve
        </ActionButton>
      </div>
      <EditChangeDialog change={change} open={editing} onOpenChange={setEditing} />
    </div>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: 'ArrowUp' | 'ArrowDown';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      {...hoverProps}
      className={cn(adminButton.small, 'relative w-[38px] px-0 after:absolute after:-inset-1')}
    >
      <AdminIcon ref={iconRef} name={icon} />
    </button>
  );
}
