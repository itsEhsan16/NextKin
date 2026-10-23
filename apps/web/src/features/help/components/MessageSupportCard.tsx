import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_REPLY_WINDOW,
  SUPPORT_TOPIC_LABEL,
  SUPPORT_TOPIC_ORDER,
  type SupportTopic,
} from '@nextkin/shared/models';
import { useCurrentUser, useSubmitTicket } from '@nextkin/shared/queries';
import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';

import { cn } from '@/lib/cn';
import { cardPad, cardSurface } from '@/ui/Card';
import { showToast } from '@/lib/toast';
import { brandButton } from '@/ui/brandButton';
import { fieldBox } from '@/ui/fieldBox';
import { MailIcon, SendIcon } from '@/ui/icons';
import { SettingsEmailIllustration } from '@/ui/illustrations';
import { SelectField } from '@/ui/SelectField';
import { StableLabel } from '@/ui/StableLabel';

const LABEL = 'text-body-m font-medium text-text-primary';
const HINT = 'mt-1.5 text-body-s text-text-tertiary';

/**
 * "Message support" (577:6606): what it's about, where the reply goes (the account's own address,
 * read-only, as `SupportTicket` has it), and the message, up to 2,000 characters. Send stays in
 * full colour, as drawn; an empty press says why rather than doing nothing. The shared layer's
 * `useSubmitTicket` sends it, and a toast confirms with the published reply window.
 */
export function MessageSupportCard() {
  const user = useCurrentUser();
  const submit = useSubmitTicket();
  const [topic, setTopic] = useState<SupportTopic>('question');
  const [message, setMessage] = useState('');
  const [tried, setTried] = useState(false);
  const topicHint = useId();
  const replyHint = useId();
  const messageId = useId();
  const problemId = useId();

  const empty = message.trim().length === 0;
  const problem = tried && empty ? 'Write a message first.' : null;

  const send = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (empty || submit.isPending) return;
    submit.mutate(
      { topic, message: message.trim() },
      {
        onSuccess: () => {
          setMessage('');
          setTried(false);
          showToast(`Message sent. ${SUPPORT_REPLY_WINDOW}`);
        },
        onError: () => showToast("We couldn't send your message. Try again.", { tone: 'error' }),
      },
    );
  };

  return (
    <form
      onSubmit={send}
      noValidate
      aria-labelledby="message-support"
      className={cn(cardSurface, cardPad, 'flex flex-col')}
    >
      <div className="flex items-center gap-4 rounded-md bg-neutral-50 px-4 py-4">
        <SettingsEmailIllustration aria-hidden className="h-auto w-13 shrink-0" />
        <div className="min-w-0">
          <p className="text-body-s font-medium text-text-brand">Still stuck?</p>
          <h2 id="message-support" className="text-title-l text-text-primary">
            Message support
          </h2>
          <p className="text-body-s text-text-secondary">{SUPPORT_REPLY_WINDOW}</p>
        </div>
      </div>

      <p className={cn(LABEL, 'mt-6')}>Topic</p>
      <SelectField
        label="Topic"
        describedBy={topicHint}
        value={topic}
        options={SUPPORT_TOPIC_ORDER}
        labelOf={(option) => SUPPORT_TOPIC_LABEL[option]}
        onChange={setTopic}
        className="mt-2 h-control-lg"
      />
      <p id={topicHint} className={HINT}>
        Choose what your message is about
      </p>

      <p className={cn(LABEL, 'mt-5')}>Reply goes to</p>
      <div
        aria-describedby={replyHint}
        className={cn(fieldBox, 'mt-2 h-control-lg gap-2.5 bg-neutral-50 px-3 text-text-secondary')}
      >
        <MailIcon aria-hidden className="size-4 shrink-0 text-text-tertiary" />
        <span className="truncate">{user.data?.email ?? ''}</span>
      </div>
      <p id={replyHint} className={HINT}>
        Change it in{' '}
        <Link
          href="/settings"
          className="rounded-sm text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Account settings
        </Link>
        .
      </p>

      <label htmlFor={messageId} className={cn(LABEL, 'mt-5')}>
        Your message
      </label>
      <textarea
        id={messageId}
        value={message}
        maxLength={SUPPORT_MESSAGE_MAX}
        aria-invalid={problem != null}
        aria-describedby={problem ? problemId : undefined}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="What happened?"
        rows={6}
        className={cn(
          fieldBox,
          'mt-2 h-auto min-h-40 resize-none items-start px-3.5 py-3 placeholder:text-text-tertiary',
        )}
      />
      <div className="mt-1.5 flex items-start gap-3">
        <p id={problemId} className="min-w-0 flex-1 text-body-s text-danger-600">
          {problem}
        </p>
        <p className="shrink-0 text-body-s text-text-tertiary">
          {message.length} / {SUPPORT_MESSAGE_MAX}
        </p>
      </div>

      <button
        type="submit"
        aria-disabled={submit.isPending}
        className={cn(
          brandButton,
          'mt-5 h-control-lg w-full gap-2 rounded-md text-body-m font-semibold aria-disabled:cursor-default aria-disabled:opacity-60',
        )}
      >
        <SendIcon aria-hidden className="size-4" />
        <StableLabel label="Send" busyLabel="Sending…" busy={submit.isPending} />
      </button>
    </form>
  );
}
