import type { AssistantAttachment } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { iconButton } from '@/ui/iconButton';
import { BookmarkIcon, CloseIcon, DocumentIcon } from '@/ui/icons';

/**
 * Something attached to a message (772:442): a type tile, the name over what it is, and in the
 * composer an × that takes it off again.
 */
export function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: AssistantAttachment;
  onRemove?: () => void;
}) {
  const Glyph = attachment.kind === 'job' ? BookmarkIcon : DocumentIcon;
  return (
    <div className="flex max-w-[280px] items-center gap-2.5 rounded-lg border border-border-default bg-neutral-50 py-1.5 pl-2 pr-2.5">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-text-brand"
      >
        <Glyph className="size-4" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-body-m font-semibold text-text-primary">
          {attachment.title}
        </span>
        <span className="block truncate text-micro font-medium text-text-tertiary">
          {attachment.detail}
        </span>
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${attachment.title}`}
          onClick={onRemove}
          className={cn(
            iconButton,
            '-mr-1 size-6 shrink-0 text-neutral-400 hover:text-text-secondary',
          )}
        >
          <CloseIcon aria-hidden className="size-3" />
        </button>
      )}
    </div>
  );
}
