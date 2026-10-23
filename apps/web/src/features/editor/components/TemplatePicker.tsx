'use client';

import { RESUME_TEMPLATES, type ResumeTemplateId } from '@nextkin/shared/models';
import * as Dropdown from '@radix-ui/react-dropdown-menu';

import { ChevronDownIcon } from '@/ui/icons';
import { Check } from '@/ui/lineIcons';
import { chevronTurn, menuSurfaceMotion, menuTrigger } from '@/ui/menuMotion';
import { outlineButton } from '@/ui/outlineButton';
import { cn } from '@/lib/cn';

/**
 * The page's design (toreview §124). Each is one column of real text with standard headings, so
 * switching never costs a parse; the live view and the PDF both follow the choice.
 */

const SWATCH: Record<ResumeTemplateId, { align: string; heading: string; font: string }> = {
  jake: { align: 'items-center', heading: 'border-neutral-700', font: 'font-serif' },
  modern: { align: 'items-start', heading: 'border-brand-600', font: 'font-sans' },
  elegant: { align: 'items-center', heading: 'border-neutral-400', font: 'font-serif italic' },
};

function Swatch({ id }: { id: ResumeTemplateId }) {
  const s = SWATCH[id];
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-14 w-11 shrink-0 flex-col gap-1 rounded-sm border border-border-default bg-surface-card p-1.5',
        s.align,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-6 rounded-full',
          id === 'modern' ? 'bg-neutral-800' : 'bg-neutral-700',
        )}
      />
      <span className={cn('mt-0.5 w-full border-b', s.heading)} />
      <span className="h-1 w-full rounded-full bg-neutral-200" />
      <span className="h-1 w-4/5 rounded-full bg-neutral-200" />
      <span className={cn('w-full border-b', s.heading)} />
      <span className="h-1 w-full rounded-full bg-neutral-200" />
    </span>
  );
}

export function TemplatePicker({
  value,
  onChange,
}: {
  value: ResumeTemplateId;
  onChange: (id: ResumeTemplateId) => void;
}) {
  const current = RESUME_TEMPLATES.find((t) => t.id === value) ?? RESUME_TEMPLATES[0]!;
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          aria-label={`Template: ${current.name}`}
          className={cn(
            outlineButton,
            menuTrigger,
            'h-control-sm gap-2 rounded-md px-3 text-body-m font-semibold',
          )}
        >
          Template: {current.name}
          <ChevronDownIcon aria-hidden className={cn('size-3.5', chevronTurn)} />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={8}
          className={cn(
            'z-50 w-[320px] rounded-lg border border-border-default bg-surface-card p-2 shadow-popover',
            menuSurfaceMotion,
          )}
        >
          <Dropdown.Label className="px-2 pb-1.5 pt-1 text-caption-m text-text-tertiary">
            Every template is one column and ATS-safe.
          </Dropdown.Label>
          {RESUME_TEMPLATES.map((t) => (
            <Dropdown.Item
              key={t.id}
              onSelect={() => onChange(t.id)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md p-2 outline-none data-[highlighted]:bg-surface-muted',
                t.id === value && 'bg-surface-brand',
              )}
            >
              <Swatch id={t.id} />
              <span className="min-w-0 flex-1">
                <span className="block text-body-m font-semibold text-text-primary">{t.name}</span>
                <span className="block text-caption-m text-text-secondary">{t.description}</span>
              </span>
              {t.id === value && (
                <Check aria-label="Current template" className="size-4 shrink-0 text-text-brand" />
              )}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
