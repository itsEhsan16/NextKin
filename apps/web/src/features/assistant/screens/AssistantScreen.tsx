'use client';

import type { AssistantAttachment } from '@nextkin/shared/models';
import {
  queryPhase,
  useAssistantConversation,
  useAssistantThreads,
  useClearAssistant,
  useCurrentUser,
  useJob,
  useResume,
  useOpenAssistantThread,
  useSendAssistantMessage,
  useStartAssistantChat,
  useSubscription,
} from '@nextkin/shared/queries';
import { useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { useReveal } from '@/lib/useReveal';
import { showToast } from '@/lib/toast';
import { PageHeader } from '@/navigation/PageHeader';
import { pageFillInBar, pageFillMin, pageFrameInBar } from '@/ui/pageFrame';
import { CollapseFade } from '@/ui/CollapseFade';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import {
  fileAttachment,
  isAcceptedFile,
  jobAttachment,
  resumeAttachment,
} from '../assistantLibrary';
import { DailyMessagesCard, ReadOnlyNote } from '../components/AssistantAsides';
import { AssistantWelcome } from '../components/AssistantWelcome';
import { Composer } from '../components/Composer';
import { HistoryCard } from '../components/HistoryCard';
import { PromptChips } from '../components/PromptChips';
import { Transcript } from '../components/Transcript';

const sameAttachment = (a: AssistantAttachment, b: AssistantAttachment) =>
  a.kind === b.kind && a.id === b.id;

/**
 * The AI Assistant (767:2 welcome, 767:275 conversation, 772:2 attach menu, 772:165 attached),
 * which replaced its coming-soon page: the chat on a white canvas with the composer at its foot,
 * and beside it the History, today's message count and the read-only promise.
 *
 * V2 §7.16 keeps it read-and-advise: nothing on this page writes to a resume, a document, a job
 * or the profile. Attaching reads; clearing touches only the chat.
 */
export function AssistantScreen({ jobId, resumeId }: { jobId?: string; resumeId?: string } = {}) {
  const user = useCurrentUser();
  const conversation = useAssistantConversation();
  const threads = useAssistantThreads();
  const subscription = useSubscription();
  const send = useSendAssistantMessage();
  const openThread = useOpenAssistantThread();
  const startNew = useStartAssistantChat();
  const clear = useClearAssistant();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const revealChat = useReveal(conversation.data != null, conversation.data?.id);
  const meterArrived = useReveal(subscription.data != null);
  const [draft, setDraft] = useState('');
  // What the page was opened about is attached until the user changes the attachments; `null`
  // means "still the arrival's", so it fills in once the job or resume has loaded.
  const [picked, setPicked] = useState<AssistantAttachment[] | null>(null);
  const aboutJob = useJob(jobId ?? '');
  const aboutResume = useResume(resumeId ?? '');
  const arrival = [
    ...(aboutJob.data ? [jobAttachment(aboutJob.data)] : []),
    ...(aboutResume.data ? [resumeAttachment(aboutResume.data)] : []),
  ];
  const attachments = picked ?? arrival;
  const setAttachments = (next: (current: AssistantAttachment[]) => AssistantAttachment[]) =>
    setPicked((current) => next(current ?? arrival));

  const messages = conversation.data?.messages ?? [];
  const streaming = messages.at(-1)?.status === 'streaming';
  const busy = send.isPending || streaming;
  const usage = subscription.data?.usage;
  const limit = usage?.assistantMessagesLimit ?? 0;
  const used = usage?.assistantMessagesUsed ?? 0;
  // Unknown is not unlimited: with no plan read, the composer waits rather than opening the cap.
  const spent = usage != null && limit > 0 && used >= limit;

  const focusComposer = () => requestAnimationFrame(() => inputRef.current?.focus());

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || busy || spent) return;
    const resume = attachments.find((attachment) => attachment.kind === 'resume');
    send.mutate(
      {
        text: trimmed,
        ...(resume ? { resumeId: resume.id } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
      },
      {
        onSuccess: () => {
          setDraft('');
          setPicked([]);
        },
        onError: () =>
          showToast("Your message didn't send. Check your connection and try again.", {
            tone: 'error',
          }),
      },
    );
  };

  const toggleAttachment = (attachment: AssistantAttachment) => {
    setAttachments((current) =>
      current.some((item) => sameAttachment(item, attachment))
        ? current.filter((item) => !sameAttachment(item, attachment))
        : [...current, attachment],
    );
    focusComposer();
  };

  const attachFile = (file: File) => {
    if (!isAcceptedFile(file)) {
      showToast('Attach a PDF or DOCX file.', { tone: 'error' });
      return;
    }
    toggleAttachment(fileAttachment(file));
  };

  if (queryPhase(conversation) === 'error' || queryPhase(subscription) === 'error') {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          tone="danger"
          title="Something went wrong"
          message="We couldn't load your chats. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            void conversation.refetch();
            void subscription.refetch();
          }}
        />
      </div>
    );
  }

  const loading = conversation.isPending || subscription.isPending;
  // The chat fades in as it loads, and again whenever another one takes its place (§102).
  const chatKey = conversation.data?.id ?? 'loading';
  const empty = !loading && messages.length === 0;

  return (
    <div className={cn(pageFrameInBar, pageFillInBar, 'flex flex-col pb-6')}>
      <PageHeader title="AI Assistant" />

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_var(--spacing-aside-slim)] gap-6">
        <section
          aria-label="Chat"
          className={cn(cardSurface, 'flex min-h-0 flex-col overflow-hidden')}
        >
          <div
            data-chat-scroller
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-11 pt-10 [@media(max-height:860px)]:pt-4"
          >
            {loading ? (
              // The welcome's shape: most visits open on an empty chat (`toreview.md` §102).
              <div className="mx-auto flex w-full max-w-narrow flex-col items-center gap-3 pb-4">
                <Skeleton className="size-[120px] rounded-full [@media(max-height:860px)]:size-[72px]" />
                <Skeleton className="h-9 w-80 rounded-md" />
                <Skeleton className="h-5 w-96 rounded-md" />
                <div className="mt-3 grid w-full grid-cols-2 gap-3.5">
                  {[0, 1, 2, 3].map((tile) => (
                    <Skeleton key={tile} className="h-16 rounded-xl" />
                  ))}
                </div>
              </div>
            ) : empty ? (
              <div
                key={chatKey}
                className={cn(
                  'pb-4 [@media(max-height:860px)]:pb-2',
                  revealChat && 'animate-reveal',
                )}
              >
                <AssistantWelcome
                  firstName={user.data?.firstName}
                  busy={busy || spent}
                  onAsk={ask}
                  onStart={(starter) => {
                    setDraft(starter);
                    focusComposer();
                  }}
                />
              </div>
            ) : (
              <div
                key={chatKey}
                className={cn('mt-auto flex flex-col pb-4', revealChat && 'animate-reveal')}
              >
                <Transcript messages={messages} />
                {/* Folds away as the user starts typing, rather than jumping the chat (§102). */}
                <CollapseFade
                  axis="vertical"
                  open={draft.length === 0 && attachments.length === 0 && !busy}
                  inert={!(draft.length === 0 && attachments.length === 0 && !busy)}
                >
                  <div className="pt-6">
                    <PromptChips onAsk={ask} disabled={spent} />
                  </div>
                </CollapseFade>
              </div>
            )}
          </div>
          <Composer
            inputRef={inputRef}
            draft={draft}
            onDraftChange={setDraft}
            attachments={attachments}
            isAttached={(attachment) =>
              attachments.some((item) => sameAttachment(item, attachment))
            }
            onToggleAttachment={toggleAttachment}
            onAttachFile={attachFile}
            onSend={() => ask(draft)}
            busy={busy || loading}
            spent={spent}
            showDisclaimer={messages.length === 0}
          />
        </section>

        <div className="flex min-h-0 flex-col gap-5">
          <HistoryCard
            threads={threads.data}
            loading={threads.isPending}
            failed={threads.isError}
            onRetry={() => void threads.refetch()}
            onOpen={(id) => {
              if (!openThread.isPending) openThread.mutate(id);
            }}
            onNew={() => {
              startNew.mutate(undefined, { onSuccess: focusComposer });
            }}
            onClear={() => clear.mutate()}
            canClear={messages.length > 0}
          />
          {subscription.data ? (
            <DailyMessagesCard
              used={used}
              limit={limit}
              plan={subscription.data.plan}
              sweep={meterArrived}
            />
          ) : (
            <Skeleton className="h-[106px] rounded-lg" />
          )}
          <ReadOnlyNote />
        </div>
      </div>
    </div>
  );
}
