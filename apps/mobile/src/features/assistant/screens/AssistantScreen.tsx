import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, type ScrollView } from 'react-native';

import { ASSISTANT_DISCLAIMER, type AssistantMessage } from '@/data/models';
import {
  useAssistantConversation,
  useResume,
  useSendAssistantMessage,
  useSubscription,
} from '@/data/queries';
// Deep import on purpose: the create barrel drags its screens in. The banner is a plain card.
import { UsageBanner } from '@/features/create/components/UsageBanner';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';

import { AssistantComposer } from '../components/AssistantComposer';
import { MessageBubble, StreamingBubble } from '../components/MessageBubble';
import { SuggestedPrompts } from '../components/SuggestedPrompts';
import { useAssistantActions } from '../hooks/useAssistantActions';

export type AssistantScreenProps = { resumeId?: string };

/** The user turn a failed reply answered, for its "Try again". */
const questionBefore = (messages: readonly AssistantMessage[], index: number) => {
  for (let i = index - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === 'user') return message.text;
  }
  return undefined;
};

/**
 * AI ASSISTANT (V2 §7.16). No artboard covers it (plan §8, phase 9I).
 *
 * Read-and-advise only, by construction: nothing on this screen calls a mutation other than
 * `send` — no button here edits a document, applies a fix, saves a job or changes the profile.
 * A later phase that wants the assistant to *do* things needs §7.16's Release 2 and a new repo
 * verb, not a button added here.
 *
 * The transcript is the page's scroller and the composer is its footer, so the composer rides
 * the keyboard the way every other form's action bar does. Streaming lands in one leaf
 * (`StreamingBubble`); the rest of the list is `memo` and holds still.
 */
export function AssistantScreen({ resumeId }: AssistantScreenProps) {
  const { spacing, s } = useTheme();
  const reduced = useReducedMotion();
  const actions = useAssistantActions();

  const conversation = useAssistantConversation();
  const subscription = useSubscription();
  const resume = useResume(resumeId ?? '');
  const send = useSendAssistantMessage();

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const messages = conversation.data?.messages ?? [];
  const streaming = messages.some((message) => message.status === 'streaming');
  const usage = subscription.data?.usage;
  const limit = usage?.assistantMessagesLimit ?? 0;
  const used = usage?.assistantMessagesUsed ?? 0;
  // Unknown is not unlimited: with no plan read, the composer waits rather than opening the cap.
  const spent = usage != null && limit > 0 && used >= limit;

  // A new turn — sent or streamed to completion — brings the end of the thread into view.
  const count = messages.length;
  useEffect(() => {
    if (count > 0) scrollRef.current?.scrollToEnd({ animated: !reduced });
  }, [count, reduced]);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || send.isPending || streaming || spent) return;
    send.mutate(
      { text: trimmed, ...(resumeId ? { resumeId } : {}) },
      { onSuccess: () => setDraft('') },
    );
  };

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      keyboard
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="AI assistant" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[3] }}
      footer={footer}
      scrollRef={scrollRef}
      contentContainerStyle={{ paddingBottom: spacing[6], gap: spacing[4] }}
    >
      {children}
    </Screen>
  );

  if (conversation.isPending || subscription.isPending) {
    return page(
      <View style={{ gap: spacing[3] }}>
        <Skeleton height={s(56)} radius="card" width="70%" />
        <Skeleton height={s(96)} radius="card" style={{ alignSelf: 'flex-end' }} width="80%" />
        <Skeleton height={s(72)} radius="card" width="75%" />
      </View>,
      <AssistantComposer
        value=""
        onChange={() => {}}
        onSend={() => {}}
        busy
        failed={false}
        disabled
      />,
    );
  }

  if (conversation.isError || subscription.isError) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load the conversation"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          void conversation.refetch();
          void subscription.refetch();
        }}
      />,
    );
  }

  const footer = spent ? (
    // §13.5: at zero the composer is REPLACED by the upsell, not overlaid. The label stays.
    <StickyActionBar
      note={ASSISTANT_DISCLAIMER}
      primary={{ label: 'See Pro plans', onPress: actions.openUpgrade }}
    />
  ) : (
    <AssistantComposer
      value={draft}
      onChange={setDraft}
      onSend={() => ask(draft)}
      busy={send.isPending || streaming}
      failed={send.isError}
    />
  );

  return page(
    <>
      {resumeId && resume.data ? (
        <View style={{ flexDirection: 'row' }}>
          <Chip label={`About: ${resume.data.title}`} tone="brand" />
        </View>
      ) : null}

      {/* §13.5: the meter is on screen before the cap is hit, in the cap's own period. */}
      <UsageBanner used={used} limit={limit} noun="message" period="day" />

      {messages.length === 0 ? <SuggestedPrompts intro onPick={setDraft} /> : null}

      {messages.map((message, index) =>
        message.status === 'streaming' ? (
          <StreamingBubble
            key={message.id}
            messageId={message.id}
            onRetry={() => {
              const question = questionBefore(messages, index);
              if (question) ask(question);
            }}
          />
        ) : (
          <MessageBubble
            key={message.id}
            message={message}
            onRetry={
              message.status === 'failed'
                ? () => {
                    const question = questionBefore(messages, index);
                    if (question) ask(question);
                  }
                : undefined
            }
          />
        ),
      )}

      {/* Nothing here when the cap is spent: the meter above already says "0 of 20 left today"
          and the bar below says what Pro does about it. A third line saying it again was the
          screen telling the reader the same fact three ways. */}
      {!spent && messages.length > 0 && draft.length === 0 && !streaming ? (
        <SuggestedPrompts onPick={setDraft} />
      ) : null}
    </>,
    footer,
  );
}
