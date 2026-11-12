'use client';

import { ASSISTANT_DISCLAIMER, type AssistantAttachment } from '@nextkin/shared/models';
import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { InfoCircleIcon, SendIcon } from '@/ui/icons';
import { pressable } from '@/ui/pressable';

import { FILE_ACCEPT, MESSAGE_MAX } from '../assistantLibrary';
import { AttachMenu } from './AttachMenu';
import { AttachmentChip } from './AttachmentChip';

export type ComposerProps = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  draft: string;
  onDraftChange: (draft: string) => void;
  attachments: AssistantAttachment[];
  isAttached: (attachment: AssistantAttachment) => boolean;
  onToggleAttachment: (attachment: AssistantAttachment) => void;
  onAttachFile: (file: File) => void;
  onSend: () => void;
  /** A reply is on its way: the user may keep typing, but not send. */
  busy: boolean;
  /**
   * The AI-guidance label (V2 §7.16) above the box: shown on a new conversation, folded away once
   * it has messages (owner, toreview §132.7).
   */
  showDisclaimer?: boolean;
  /** Today's messages are used up. */
  spent: boolean;
};

/** Up to four lines, then the field scrolls. */
const fit = (field: HTMLTextAreaElement) => {
  field.style.height = 'auto';
  field.style.height = `${Math.min(field.scrollHeight, 88)}px`;
};

/**
 * The composer (768:108): the pill with the paperclip, the field and the send button, and under
 * it the count against the cap and the AI-guidance line. The board's "Attach a file" link under
 * the pill went at the owner's word (2026-10-10); the paperclip's menu is the one way in. Attached things sit in
 * the pill above the field (772:441), each with an × to take it off. Enter sends; Shift+Enter
 * starts a new line.
 */
export function Composer({
  inputRef,
  draft,
  onDraftChange,
  attachments,
  isAttached,
  onToggleAttachment,
  onAttachFile,
  onSend,
  busy,
  spent,
  showDisclaimer = true,
}: ComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend = draft.trim().length > 0 && !busy && !spent;
  // Full colour even while empty, as the boards draw it; an empty press puts you in the field.
  const press = () => (canSend ? onSend() : inputRef.current?.focus());

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 px-5 pb-4 pt-4">
      <CollapseFade axis="vertical" open={showDisclaimer} className="w-full">
        <p className="flex items-center justify-center gap-1.5 text-body-s text-text-tertiary">
          <InfoCircleIcon aria-hidden className="size-3 text-neutral-400" />
          {ASSISTANT_DISCLAIMER}
        </p>
      </CollapseFade>
      <div
        className={cn(
          'flex w-full flex-col gap-2.5 border border-border-default bg-surface-card shadow-popover transition-[border-color,box-shadow,padding,border-radius] duration-base ease-standard focus-within:border-border-brand-strong focus-within:ring-4 focus-within:ring-brand-100',
          attachments.length > 0
            ? 'rounded-3xl pb-2 pl-2.5 pr-2 pt-2.5'
            : 'rounded-full py-1.5 pl-3 pr-1.5',
        )}
      >
        {attachments.length > 0 && (
          <ul aria-label="Attached" className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <li key={`${attachment.kind}:${attachment.id}`} className="animate-pop-in">
                <AttachmentChip
                  attachment={attachment}
                  onRemove={() => onToggleAttachment(attachment)}
                />
              </li>
            ))}
          </ul>
        )}
        {/* Out of messages: said in place of a dead box, with the way to more (AS-02, V2 §13.5). */}
        {spent && (
          <p className="mb-2 flex flex-wrap items-center gap-x-2 rounded-md bg-surface-paid px-3 py-2 text-body-s text-text-paid">
            You’ve used today’s messages. They come back tomorrow.
            <Link
              href={'/upgrade' as Route}
              className="font-semibold underline-offset-2 hover:underline"
            >
              See Pro plans
            </Link>
          </p>
        )}
        <div className="flex items-center gap-3">
          <AttachMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            isAttached={isAttached}
            onToggle={onToggleAttachment}
            onUploadFile={() => fileRef.current?.click()}
            disabled={spent}
          />
          <label htmlFor="assistant-message" className="sr-only">
            Ask a question
          </label>
          <textarea
            id="assistant-message"
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MESSAGE_MAX}
            disabled={spent}
            placeholder={spent ? "You've used today's messages." : 'Ask a question…'}
            onChange={(event) => {
              onDraftChange(event.target.value);
              fit(event.target);
            }}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 resize-none bg-transparent py-3 text-prose text-text-primary outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed"
          />
          <button
            type="button"
            aria-label="Send"
            disabled={busy || spent}
            onClick={press}
            className={cn(
              pressable,
              'flex size-control-lg shrink-0 items-center justify-center rounded-full bg-brand-600 text-text-inverse shadow-button',
              'not-disabled:hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            )}
          >
            <SendIcon aria-hidden className="size-4.5" />
          </button>
        </div>
      </div>

      <div className="flex w-full items-center gap-4 px-4">
        <input
          ref={fileRef}
          type="file"
          accept={FILE_ACCEPT}
          aria-hidden
          tabIndex={-1}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onAttachFile(file);
            event.target.value = '';
          }}
        />
        <span className="flex-1" />
        <span className="text-body-s font-medium tabular-nums text-text-tertiary">
          <span className="sr-only">Characters used: </span>
          {draft.length} / {MESSAGE_MAX}
        </span>
      </div>
    </div>
  );
}
