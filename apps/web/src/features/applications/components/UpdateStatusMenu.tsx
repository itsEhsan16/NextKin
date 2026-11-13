import type { ApplicationStatus } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { FilterDropdown, FilterRadioGroup } from '@/ui/FilterDropdown';
import { HugeChevronDown } from '@/ui/hugeIcons';
import { chevronTurn, menuTrigger } from '@/ui/menuMotion';
import { StableLabel } from '@/ui/StableLabel';

import { SETTABLE_STATUSES, STAGE_LABEL } from '../applicationStage';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

export type UpdateStatusMenuProps = {
  status: ApplicationStatus;
  onChange: (status: ApplicationStatus) => void;
  /** The change is being saved: the trigger says so. */
  saving?: boolean;
};

const OPTIONS = SETTABLE_STATUSES.map((value) => [value, STAGE_LABEL[value]] as const);

/**
 * "Update Status ▼" (332:467): the candidate records where an application has got to. The board
 * never draws it open. One status at a time, so radio rows (redesign R6d, audit AP-07); while a
 * change saves, the trigger says "Saving…" without changing width (AP-08). The trigger is the Jobs
 * card's "Save Job" outline at `control-lg`, beside the primary action as it is there.
 */
export function UpdateStatusMenu({ status, onChange, saving = false }: UpdateStatusMenuProps) {
  return (
    <FilterDropdown
      align="end"
      trigger={
        <button
          type="button"
          aria-busy={saving || undefined}
          className={cn(
            BUTTON_VARIANT.secondary,
            'flex h-control-lg w-full gap-2 rounded-md text-body-l font-semibold',
            menuTrigger,
          )}
        >
          <StableLabel label="Update Status" busyLabel="Saving…" busy={saving} />
          <HugeChevronDown className={cn('size-4 text-text-secondary', chevronTurn)} />
        </button>
      }
    >
      <FilterRadioGroup
        value={status}
        onValueChange={(value) => {
          if (value !== status) onChange(value);
        }}
        options={OPTIONS}
      />
    </FilterDropdown>
  );
}
