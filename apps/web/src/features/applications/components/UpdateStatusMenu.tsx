import type { ApplicationStatus } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { ChevronDownIcon } from '@/ui/icons';
import { outlineButton } from '@/ui/outlineButton';
import { chevronTurn, menuTrigger } from '@/ui/menuMotion';

import { SETTABLE_STATUSES, STAGE_LABEL } from '../applicationStage';

export type UpdateStatusMenuProps = {
  status: ApplicationStatus;
  onChange: (status: ApplicationStatus) => void;
};

/**
 * "Update Status ▼" (332:467): the candidate records where an application has got to. The board
 * never draws it open, so the menu is the sort control's `FilterDropdown` with one checked row per
 * status. The trigger is the Jobs card's "Save Job" outline at `control-lg`, beside the primary
 * action as it is there.
 */
export function UpdateStatusMenu({ status, onChange }: UpdateStatusMenuProps) {
  return (
    <FilterDropdown
      align="end"
      trigger={
        <button
          type="button"
          className={cn(
            outlineButton,
            'flex h-control-lg w-full gap-2 rounded-md text-body-l font-semibold',
            menuTrigger,
          )}
        >
          Update Status
          <ChevronDownIcon className={cn('size-4 text-text-secondary', chevronTurn)} />
        </button>
      }
    >
      {SETTABLE_STATUSES.map((value) => (
        <FilterCheckboxItem
          key={value}
          checked={status === value}
          onCheckedChange={() => {
            if (value !== status) onChange(value);
          }}
        >
          {STAGE_LABEL[value]}
        </FilterCheckboxItem>
      ))}
    </FilterDropdown>
  );
}
