import { cn } from '@/lib/cn';

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The setting it turns on and off. */
  label: string;
  /** What the setting does, read after its name: the id of the line beside it. */
  describedBy?: string;
  disabled?: boolean;
};

/**
 * An on/off setting: the Account page's notification preferences. No board draws one, so it is
 * the smallest control the tokens make: the brand fill when on, the neutral track when off, a
 * white knob that slides between them on the standard curve.
 */
export function Switch({ checked, onChange, label, describedBy, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60',
        checked ? 'bg-brand-600' : 'bg-neutral-200',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-4 rounded-full bg-surface-card shadow-card transition-transform duration-fast ease-standard',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
