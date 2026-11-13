import { cn } from '@/lib/cn';
import { TickIcon } from '@/ui/icons';

export type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/**
 * A tick box and its word: the Preferences board's job types (356:26-38). A real checkbox under
 * the drawn box, so it keeps the browser's keyboard and form behaviour: a hairline square when
 * off, the brand fill with a white tick when on.
 */
export function Checkbox({ label, checked, onChange, disabled }: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 text-body-m text-text-primary',
        disabled ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-checkbox border transition-colors duration-press ease-standard peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600',
          checked
            ? 'border-brand-600 bg-brand-600 text-text-inverse'
            : 'border-neutral-400 bg-surface-card',
        )}
      >
        {/* Always there, so it can grow in with the fill rather than pop (`toreview.md` §84). */}
        <TickIcon
          className={cn(
            'size-3 transition-[opacity,scale] duration-press ease-standard',
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
        />
      </span>
      {label}
    </label>
  );
}
