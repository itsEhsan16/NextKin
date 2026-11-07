import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, type ScrollViewInstance } from 'react-native';

import { atsQuickWins, type AssistantMessage, type Resume } from '@/data/models';
import {
  useAssistantConversation,
  useCurrentUser,
  useOpenAssistantThread,
  useResumeScore,
  useResumes,
  useSendAssistantMessage,
  useStartAssistantChat,
  useSubscription,
} from '@/data/queries';
// Deep imports on purpose: those barrels drag their screens in. These are plain pieces.
import { useSetupAnswers } from '@/features/create/setupAnswers';
import { docSubtitle } from '@/features/resumes/docMeta';
import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/kit';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { useAssistantDraftStore } from '../assistantDraftStore';
import { followUps, starterPrompts } from '../assistantPrompts';
import { AssistantComposer, AssistantLabel } from '../components/AssistantComposer';
import { AssistantHistorySheet } from '../components/AssistantHistorySheet';
import { DraftComposer } from '../components/DraftComposer';
import { MessageBubble, StreamingBubble } from '../components/MessageBubble';
import { AssistantWelcome, FollowUpChips } from '../components/SuggestedPrompts';
import { useAssistantActions } from '../hooks/useAssistantActions';

export type AssistantScreenProps = { resumeId?: string };

/** "No resume": the picker's last row. */
const NONE = '__none';

/** The user turn a failed reply answered, for its "Try again". */
const questionBefore = (messages: readonly AssistantMessage[], index: number) => {
  for (let i = index - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === 'user') return message.text;
  }
  return undefined;
};

const isUsable = (resume: Resume) =>
  resume.docType === 'resume' && resume.status === 'ready' && !resume.archived;

/**
 * AI ASSISTANT (V2 §7.16; redesigned 2026-11-08, §188).
 *
 * What makes it smart rather than a blank chat box:
 * - It answers about YOUR resume by default: the one it was opened from, else the latest one you
 *   have. The chip over the field says which, and you can switch it or turn it off.
 * - An empty chat greets you by name and offers four questions made from what you have (your
 *   resume's real score, the role you named at sign-up), each asked with one tap.
 * - Under each answer: the resume it used, Copy, and two follow-ups on the same topic.
 * - Chats are kept: "New chat" starts fresh, the history reopens an earlier one.
 *
 * Read-and-advise only, by construction: the only writes are the chat itself. Nothing here edits a
 * document, applies a fix, saves a job or changes the profile.
 */
export function AssistantScreen({ resumeId }: AssistantScreenProps) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const actions = useAssistantActions();

  const conversation = useAssistantConversation();
  const subscription = useSubscription();
  const resumes = useResumes();
  const user = useCurrentUser();
  const setupRole = useSetupAnswers((state) => state.role);
  const send = useSendAssistantMessage();
  const startNew = useStartAssistantChat();
  const openThread = useOpenAssistantThread();

  const draftEmpty = useAssistantDraftStore((state) => state.draft.length === 0);
  const setDraft = useAssistantDraftStore((state) => state.setDraft);
  // A fresh visit starts with an empty composer.
  useEffect(() => () => setDraft(''), [setDraft]);

  // undefined: pick for them. null: they turned it off. A string: the one they chose.
  const [choice, setChoice] = useState<string | null | undefined>(resumeId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const documents = useMemo(
    () =>
      (resumes.data ?? []).filter(isUsable).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [resumes.data],
  );
  const attached =
    choice === null
      ? undefined
      : (documents.find((resume) => resume.id === choice) ?? (choice ? undefined : documents[0]));
  const scored = useResumeScore(attached?.id ?? '').data;
  const score = scored?.total;
  const quickWins = scored ? atsQuickWins(scored).length : undefined;
  const titleOf = (id?: string) => (resumes.data ?? []).find((item) => item.id === id)?.title;

  const messages = useMemo(() => conversation.data?.messages ?? [], [conversation.data]);
  const streaming = messages.some((message) => message.status === 'streaming');
  const usage = subscription.data?.usage;
  const limit = usage?.assistantMessagesLimit ?? 0;
  const used = usage?.assistantMessagesUsed ?? 0;
  // Unknown is not unlimited: with no plan read, the composer waits rather than opening the cap.
  const spent = usage != null && limit > 0 && used >= limit;
  const firstRun = messages.length === 0;
  const busy = send.isPending || streaming;

  const starters = useMemo(
    () =>
      starterPrompts({
        resumeTitle: attached?.title,
        score,
        quickWins,
        role: setupRole || undefined,
      }),
    [attached?.title, quickWins, score, setupRole],
  );
  const next = useMemo(() => followUps(messages, { quickWins }), [messages, quickWins]);

  // A new turn — sent or finished — brings the end of the thread into view.
  const count = messages.length;
  useEffect(() => {
    if (count > 0) scrollRef.current?.scrollToEnd({ animated: !reduced });
  }, [count, reduced]);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || busy || spent) return;
    send.mutate(
      { text: trimmed, ...(attached ? { resumeId: attached.id } : {}) },
      { onSuccess: () => setDraft('') },
    );
  };

  const newChat = () => {
    setHistoryOpen(false);
    setDraft('');
    if (!firstRun) startNew.mutate();
  };

  const header = (
    <ScreenHeader
      title="AI Assistant"
      onBack={actions.goBack}
      trailing={
        <View style={styles.headerActions}>
          <IconButton icon="ClockRewind" label="Chats" onPress={() => setHistoryOpen(true)} />
          <IconButton
            icon="Edit03"
            label="New chat"
            disabled={firstRun || busy}
            onPress={newChat}
          />
        </View>
      }
    />
  );

  const page = (children: ReactNode, footer?: ReactNode) => (
    <>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={header}
        footer={footer}
        scrollRef={scrollRef}
        // A reply grows a line at a time while it streams; keep its end in view.
        followEnd={streaming}
        contentContainerStyle={styles.content}
      >
        {children}
      </Screen>
      <OptionSheet
        open={pickerOpen}
        title="Answer using"
        variant="card"
        options={[
          ...documents.map<SheetOption>((item) => ({
            key: item.id,
            label: item.title,
            caption: docSubtitle(item),
            leading: <IconTile name="File04" size={36} />,
          })),
          {
            key: NONE,
            label: 'No resume',
            caption: 'General answers',
            leading: <IconTile name="MessageChatSquare" size={36} tone="neutral" />,
          },
        ]}
        selectedKey={attached?.id ?? NONE}
        onSelect={(id) => {
          setChoice(id === NONE ? null : id);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
      <AssistantHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onNewChat={newChat}
        onOpen={(id) => {
          setHistoryOpen(false);
          openThread.mutate(id);
        }}
      />
    </>
  );

  if (conversation.isPending || subscription.isPending) {
    return page(
      <View
        style={styles.thread}
        accessible
        accessibilityLabel="Loading the conversation"
        accessibilityState={{ busy: true }}
      >
        <Skeleton height={u(44)} radius="card" width="60%" style={styles.end} />
        <Skeleton height={u(110)} radius="card" />
        <Skeleton height={u(44)} radius="card" width="50%" style={styles.end} />
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
        icon="AlertTriangle"
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
    // §13.5: at zero the composer is REPLACED by the upsell, not overlaid. The count is said only
    // here: before the cap the screen shows no meter (owner, 2026-11-08, §189).
    <View style={styles.spent}>
      <View style={[styles.spentCard, { backgroundColor: colors.brandSurface }]}>
        <Text variant="bodyLgStrong" color="ink" align="center">
          {`You’ve used today’s ${limit} messages`}
        </Text>
        <Text variant="callout" color="textSecondary" align="center">
          Pro gives you many more each day.
        </Text>
      </View>
      <Button label="See Pro plans" size="xl" block onPress={actions.openUpgrade} />
      <AssistantLabel />
    </View>
  ) : (
    <DraftComposer
      onSend={ask}
      busy={busy}
      failed={send.isError}
      onPickContext={documents.length > 0 ? () => setPickerOpen(true) : undefined}
      contextTitle={attached?.title}
      onClearContext={() => setChoice(null)}
    />
  );

  if (firstRun) {
    return page(
      <AssistantWelcome
        firstName={user.data?.firstName}
        prompts={starters}
        onAsk={ask}
        disabled={busy || spent}
      />,
      footer,
    );
  }

  return page(
    <View style={styles.thread}>
      {messages.map((message, index) => {
        const retry = () => {
          const question = questionBefore(messages, index);
          if (question) ask(question);
        };
        const used = titleOf(message.contextResumeId);
        return message.status === 'streaming' ? (
          <StreamingBubble
            key={message.id}
            messageId={message.id}
            onRetry={retry}
            contextTitle={used}
          />
        ) : (
          <MessageBubble
            key={message.id}
            message={message}
            contextTitle={used}
            // A sent turn arrives; a settled reply is swapping in for its streaming copy.
            enter={message.role === 'user'}
            onRetry={message.status === 'failed' ? retry : undefined}
          />
        );
      })}
      {!spent && !busy && draftEmpty ? <FollowUpChips prompts={next} onAsk={ask} /> : null}
    </View>,
    footer,
  );
}

const useStyles = scaledSheet((_s, u) => ({
  content: { paddingTop: u(8), paddingBottom: u(24) },
  headerActions: { flexDirection: 'row', gap: u(8) },
  thread: { gap: u(20) },
  end: { alignSelf: 'flex-end' },
  spent: { paddingHorizontal: u(16), paddingTop: u(8), paddingBottom: u(16), gap: u(10) },
  spentCard: { borderRadius: u(20), padding: u(16), gap: u(4) },
}));
