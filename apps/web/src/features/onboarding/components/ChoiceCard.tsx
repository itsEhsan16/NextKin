import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { cardFaceMotion } from '@/ui/pressable';

import { RadioMark } from './OptionCard';

export type ChoiceCardProps = {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint: string;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * ONB 04's two big answers (814:269, 814:298): a tick or a radio in the corner, the illustration
 * in a lavender disc, then the label and what happens next. A radio input underneath, as on
 * `OptionCard`.
 */
export function ChoiceCard({ name, value, checked, onSelect, label, hint, Art }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        cardFaceMotion,
        'flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 rounded-xl border px-5 pb-5 pt-4 active:scale-(--scale-pressed)',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600',
        checked
          ? 'border-brand-600 bg-surface-brand-strong'
          : 'border-border-default bg-surface-card hover:bg-neutral-50',
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
      <span className="flex justify-end">
        <RadioMark checked={checked} check />
      </span>
      <span
        aria-hidden
        className="mx-auto flex size-22 items-center justify-center rounded-full bg-tile-indigo"
      >
        <Art className="h-auto w-14" />
      </span>
      <span className="mt-2 text-h2 font-bold text-text-primary">{label}</span>
      <span className="text-body-m text-text-secondary">{hint}</span>
    </label>
  );
}
