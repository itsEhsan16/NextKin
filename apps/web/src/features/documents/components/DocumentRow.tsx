import type { CareerDocument } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { iconButton } from '@/ui/iconButton';
import { MoreVerticalIcon } from '@/ui/icons';
import { Tag } from '@/ui/Tag';
import { cardFaceHover, cardFaceMotion } from '@/ui/pressable';

import { documentMeta, KIND_LABEL, KIND_TONE, type DocumentView } from '../documentLibrary';
import { FileTypeTile } from './FileTypeTile';
import { Soon, soonControl } from '@/ui/Soon';

export type DocumentRowProps = {
  document: CareerDocument;
  selected: boolean;
  onSelect: () => void;
  /** `list` as drawn (286:2119); `grid` two to a row, each card stacked. */
  view: DocumentView;
};

/**
 * One file in the list (286:2119-2215): its tile, its name, what it is, how big and how old, and
 * its tag. Built like the other lists' rows: the row selects through an invisible full-cover
 * button painted first, the content over it lets clicks through everywhere but the kebab, and the
 * selected row takes the lists' 2px indigo edge.
 */
export function DocumentRow({ document, selected, onSelect, view }: DocumentRowProps) {
  const kebab = (
    // Drawn on every row (286:2130) with no menu behind it; inert, like the other lists' kebabs.
    <Soon>
      <button
        aria-disabled="true"
        type="button"
        aria-label="More options"
        className={cn(
          iconButton,
          'pointer-events-auto -mr-2 -mt-1.5 text-text-tertiary hover:text-text-primary',
          soonControl,
        )}
      >
        <MoreVerticalIcon className="size-4" />
      </button>
    </Soon>
  );

  return (
    <div className="group/card relative h-full">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        aria-label={document.title}
        className="peer absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />

      <div
        className={cn(
          'pointer-events-none relative flex h-full rounded-lg border bg-surface-card px-5 py-4 shadow-card',
          cardFaceMotion,
          view === 'list' ? 'items-start gap-4' : 'flex-col gap-3',
          selected
            ? 'border-border-selected outline-1 -outline-offset-2 outline-border-selected'
            : cn('border-border-subtle', cardFaceHover),
        )}
      >
        {view === 'grid' ? (
          <div className="flex items-start justify-between">
            <FileTypeTile format={document.format} size="row" />
            {kebab}
          </div>
        ) : (
          <FileTypeTile format={document.format} size="row" />
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-title-l font-semibold text-neutral-800">{document.title}</h3>
          <p className="mt-0.5 truncate text-body-m text-text-tertiary">{documentMeta(document)}</p>
          <Tag tone={KIND_TONE[document.kind]} className="mt-2.5">
            {KIND_LABEL[document.kind]}
          </Tag>
        </div>

        {view === 'list' && kebab}
      </div>
    </div>
  );
}
