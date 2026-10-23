import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { CheckIcon } from '@/ui/icons';
import { cardFaceMotion } from '@/ui/pressable';

import type { IconTone } from '../onboardingOptions';

const TILE: Record<IconTone, string> = {
  brand: 'bg-brand-50',
  green: 'bg-success-surface',
  blue: 'bg-tile-blue',
  amber: 'bg-tile-amber',
};

/**
 * The boards' radio: a grey ring, or an indigo disc with a white centre (814:49, 814:77). With
 * `check`, the selected state is a tick instead (ONB 04's choice cards, 814:272).
 */
export function RadioMark({ checked, check = false }: { checked: boolean; check?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-press ease-standard',
        checked ? 'border-brand-600 bg-brand-600' : 'border-neutral-400 bg-surface-card',
      )}
    >
      {check ? (
        <CheckIcon
          className={cn(
            'size-3 text-text-inverse transition-opacity duration-press ease-standard',
            !checked && 'opacity-0',
          )}
        />
      ) : (
        <span
          className={cn(
            'size-2 rounded-full bg-surface-card transition-[scale] duration-press ease-standard',
            !checked && 'scale-0',
          )}
        />
      )}
    </span>
  );
}

export type OptionCardProps = {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint?: string;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
  /** The tinted tile behind the art (ONB 03, 814:154). Without it the art stands bare (ONB 02, 827:136). */
  tone?: IconTone;
  /** `sm`: ONB 03's three-across cards (814:153), a smaller tile beside a label that wraps. */
  size?: 'md' | 'sm';
};

/**
 * One answer on ONB 02 and 03 (814:31, 814:153): an illustrated icon tile, the label and its hint,
 * and a radio. A real radio input sits under the card, so arrow keys move through the group and
 * Enter submits the step.
 */
export function OptionCard({
  name,
  value,
  checked,
  onSelect,
  label,
  hint,
  Art,
  tone,
  size = 'md',
}: OptionCardProps) {
  const small = size === 'sm';
  return (
    <label
      className={cn(
        cardFaceMotion,
        'flex cursor-pointer items-center rounded-xl border bg-surface-card pl-2 active:scale-(--scale-pressed)',
        small ? 'gap-2 py-2.5 pr-2.5' : 'gap-3 py-2 pr-3.5',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600',
        checked
          ? 'border-brand-600 bg-surface-brand-strong'
          : 'border-border-default hover:bg-neutral-50',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      {tone ? (
        <span
          aria-hidden
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg',
            small ? 'size-8' : 'size-10',
            TILE[tone],
          )}
        >
          <Art className={cn('h-auto', small ? 'w-[21px]' : 'w-[26px]')} />
        </span>
      ) : (
        <span aria-hidden className="flex w-11 shrink-0 justify-center">
          <Art className="h-auto w-11" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn('text-text-primary', small ? 'text-body-l font-semibold' : 'text-title-l')}
        >
          {label}
        </span>
        {hint && <span className="text-body-m text-text-tertiary">{hint}</span>}
      </span>
      <RadioMark checked={checked} />
    </label>
  );
}
