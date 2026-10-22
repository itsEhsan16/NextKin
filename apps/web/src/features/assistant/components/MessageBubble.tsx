'use client';

import type { AssistantMessage } from '@nextkin/shared/models';
import { useAssistantReply } from '@nextkin/shared/queries';
import { memo, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { InfoCircleIcon } from '@/ui/icons';
import { JobAiSparkleIllustration } from '@/ui/illustrations';

import { AttachmentChip } from './AttachmentChip';

/** The answers mark a number or a document's name in `**bold**`; everything else is plain. */
function withBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

/** The assistant's square (769:475): the sparkle on a lavender tile. */
function AiAvatar() {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-brand bg-surface-brand-strong"
    >
      <JobAiSparkleIllustration className="h-auto w-5" />
    </span>
  );
}

/** One of the user's turns (769:471): right-aligned on the brand fill, its attachments above. */
function UserTurn({ message, fresh }: { message: AssistantMessage; fresh: boolean }) {
  return (
    <li
      className={cn('flex flex-col items-end gap-2', fresh && 'origin-bottom-right animate-pop-in')}
    >
      {message.attachments && message.attachments.length > 0 && (
        <ul aria-label="Attached" className="flex flex-wrap justify-end gap-2">
          {message.attachments.map((attachment) => (
            <li key={`${attachment.kind}:${attachment.id}`}>
              <AttachmentChip attachment={attachment} />
            </li>
          ))}
        </ul>
      )}
      <p className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-[4px] bg-brand-600 px-4 py-2.5 text-prose text-text-inverse">
        {message.text}
      </p>
    </li>
  );
}

const ANSWER = 'max-w-[85%] whitespace-pre-wrap rounded-xl rounded-tl-[4px] px-4 py-3 text-prose';

/** The text of an answer: the finished one, or the one still arriving. */
function AnswerBody({ message }: { message: AssistantMessage }) {
  if (message.refusal) {
    // 769:491: muted, tagged, and saying what the assistant can help with instead.
    return (
      <div className={`${ANSWER} bg-surface-muted text-text-secondary`}>
        <p className="mb-1.5 flex items-center gap-1.5 text-micro font-semibold text-text-tertiary">
          <InfoCircleIcon aria-hidden className="size-3" />
          Out of scope
        </p>
        <p>{message.text}</p>
      </div>
    );
  }
  return (
    <div className={`${ANSWER} border border-border-default bg-neutral-50 text-text-primary`}>
      {message.text.length > 0 ? (
        <p>{withBold(message.text)}</p>
      ) : (
        <p className="animate-pulse text-text-tertiary">Thinking…</p>
      )}
      {message.status === 'failed' && (
        <p role="alert" className="mt-1.5 animate-reveal text-body-s text-danger-text">
          That answer stopped part-way. Ask again to get the rest.
        </p>
      )}
    </div>
  );
}

/** A reply still streaming: the one bubble that subscribes to its own key, so tokens stay local. */
function LiveAnswer({ message }: { message: AssistantMessage }) {
  const reply = useAssistantReply(message.id);
  return <AnswerBody message={reply.data ?? message} />;
}

/** One of the assistant's turns (769:474): the avatar, then the answer. */
function AssistantTurn({ message, fresh }: { message: AssistantMessage; fresh: boolean }) {
  return (
    <li className={cn('flex items-start gap-3', fresh && 'origin-top-left animate-pop-in')}>
      <AiAvatar />
      {message.status === 'streaming' ? (
        <LiveAnswer message={message} />
      ) : (
        <AnswerBody message={message} />
      )}
    </li>
  );
}

/** A turn of the transcript. Memoised over the immutable message, so a stream re-renders one leaf. */
export const MessageBubble = memo(function MessageBubble({
  message,
  fresh = false,
}: {
  message: AssistantMessage;
  /** Arrived after the chat opened, so it pops in rather than just being there. */
  fresh?: boolean;
}) {
  return message.role === 'user' ? (
    <UserTurn message={message} fresh={fresh} />
  ) : (
    <AssistantTurn message={message} fresh={fresh} />
  );
});
