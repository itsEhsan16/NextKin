import { cn } from '@/lib/cn';
import { ApartmentIcon, BriefcaseIcon } from '@/ui/icons';
import { pressable } from '@/ui/pressable';

import type { RoleAnswer } from '../onboardingStore';
import { MonthField } from './MonthField';
import { OnboardingField } from './OnboardingField';

/**
 * One role's fields on ONB 05 (816:8–816:32): job title, company, and From / To months, with
 * "Present" for a role still held. A second or later role gets a heading and a Remove.
 */
export function RoleFields({
  role,
  index,
  onChange,
  onRemove,
  disabled = false,
}: {
  role: RoleAnswer;
  index: number;
  onChange: (patch: Partial<RoleAnswer>) => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <fieldset
      disabled={disabled}
      aria-label={index === 0 ? 'Most recent job' : `Role ${index + 1}`}
      className={cn(
        'flex flex-col gap-3 transition-opacity duration-base ease-standard',
        disabled && 'opacity-50',
      )}
    >
      {onRemove && (
        <div className="flex items-center justify-between border-t border-border-subtle pt-3">
          <span className="text-body-m font-semibold text-text-primary">Role {index + 1}</span>
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              pressable,
              'rounded-sm px-1.5 text-body-m font-semibold text-text-tertiary hover:text-danger-text',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            )}
          >
            Remove
          </button>
        </div>
      )}
      <OnboardingField
        label="Job title"
        showLabel
        value={role.title}
        onChange={(title) => onChange({ title })}
        Icon={BriefcaseIcon}
        placeholder="e.g. Senior UX Designer"
        autoComplete="organization-title"
        clearable={false}
      />
      <OnboardingField
        label="Company"
        showLabel
        value={role.company}
        onChange={(company) => onChange({ company })}
        Icon={ApartmentIcon}
        placeholder="e.g. Flipkart"
        autoComplete="organization"
        clearable={false}
      />
      <div className="flex gap-3">
        <MonthField
          label="From"
          value={role.from}
          disabled={disabled}
          onChange={(from) =>
            // A To before the new From no longer makes sense, so it is cleared.
            onChange({
              from,
              ...(role.to && role.to !== 'present' && role.to < from ? { to: null } : {}),
            })
          }
        />
        <MonthField
          label="To"
          value={role.to}
          disabled={disabled}
          allowPresent
          min={role.from}
          onChange={(to) => onChange({ to })}
        />
      </div>
    </fieldset>
  );
}
