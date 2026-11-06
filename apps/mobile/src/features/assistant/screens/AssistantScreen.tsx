import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, type ScrollViewInstance } from 'react-native';
import Animated from 'react-native-reanimated';

import { ASSISTANT_DISCLAIMER, type AssistantMessage } from '@/data/models';
import {
  useAssistantConversation,
  useResumes,
  useSendAssistantMessage,
  useSubscription,
} from '@/data/queries';
// Deep imports on purpose: those barrels drag their screens in. These are plain pieces.
import { FLOW_ART, FlowHero } from '@/features/create/components/FlowHero';
import { AiPill } from '@/features/resumes/components/AiPill';
import { ResumeThumbnail } from '@/features/resumes/components/ResumeThumbnail';
import { docSubtitle } from '@/features/resumes/docMeta';
import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useRevealStagger } from '@/ui/motion';

import { useAssistantDraftStore } from '../assistantDraftStore';
import { AssistantComposer } from '../components/AssistantComposer';
import { AssistantUsage } from '../components/AssistantUsage';
import { DraftComposer } from '../components/DraftComposer';
import { MessageBubble, StreamingBubble } from '../components/MessageBubble';
import { SuggestedPrompts } from '../components/SuggestedPrompts';
import { useAssistantActions } from '../hooks/useAssistantActions';

export type AssistantScreenProps = { resumeId?: string };

const FIRST_RUN_TITLE = 'Ask about your resume, your score or the search';
const FIRST_RUN_LEDE =
  'Get clear, practical advice on your resume, ATS score, job search, interview prep and more.';

// ASSISTANT 01 / 02 at 390 (577:6485 / 577:7805), in artboard units.
const HEADER_TO_USAGE = 14; // 577:6497
const HEADER_TO_ART = 26; // 577:7812 → 674:85
const USAGE_TO_THREAD = 20; // 577:6504
const TURN_GAP = 12; // 577:6508
const THREAD_TO_PROMPTS = 22; // 577:6541
const HERO_TO_PROMPTS = 26; // 577:7827
const TITLE_WIDTH = 250; // 577:7824
const LEDE_WIDTH = 318; // 577:7826
const SHEET_THUMB = 36; // the INTERVIEW 03 row tile, 577:2902
const SHEET_THUMB_RADIUS = 8;

/** The user turn a failed reply answered, for its "Try again". */
const questionBefore = (messages: readonly AssistantMessage[], index: number) => {
  for (let i = index - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === 'user') return message.text;
  }
  return undefined;
};

/**
 * AI ASSISTANT (V2 §7.16, ASSISTANT 01 / 02 — 577:6485, 577:7805).
 *
 * Read-and-advise only, by construction: nothing on this screen calls a mutation other than
 * `send` — no button here edits a document, applies a fix, saves a job or changes the profile.
 * The paperclip attaches one of the reader's resumes as context for the answers (§7.16's context
 * awareness); it reads, it never writes.
 *
 * A blank thread is ASSISTANT 02: the robot, what to ask about, and the prompts centred. Once
 * anything has been asked it is ASSISTANT 01: the day's meter, the thread, and the prompts again
 * whenever the composer is empty. The transcript is the page's scroller and the composer is its
 * footer, so the composer rides the keyboard the way every form's action bar does.
 */
export function AssistantScreen({ resumeId }: AssistantScreenProps) {
  const { colors, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const actions = useAssistantActions();

  const conversation = useAssistantConversation();
  const subscription = useSubscription();
  const resumes = useResumes();
  const send = useSendAssistantMessage();

  // Only whether the draft is empty: the text itself lives with the composer (see the store).
  const draftEmpty = useAssistantDraftStore((state) => state.draft.length === 0);
  const setDraft = useAssistantDraftStore((state) => state.setDraft);
  // A fresh visit starts with an empty composer.
  useEffect(() => () => setDraft(''), [setDraft]);
  const [attachedId, setAttachedId] = useState(resumeId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const documents = useMemo(
    () =>
      (resumes.data ?? []).filter(
        (resume) => resume.docType === 'resume' && resume.status === 'ready',
      ),
    [resumes.data],
  );
  const attached = documents.find((resume) => resume.id === attachedId);

  const messages = conversation.data?.messages ?? [];
  const streaming = messages.some((message) => message.status === 'streaming');
  const usage = subscription.data?.usage;
  const limit = usage?.assistantMessagesLimit ?? 0;
  const used = usage?.assistantMessagesUsed ?? 0;
  // Unknown is not unlimited: with no plan read, the composer waits rather than opening the cap.
  const spent = usage != null && limit > 0 && used >= limit;
  const firstRun = messages.length === 0;
  // ASSISTANT 02 draws no meter: a fresh allowance has nothing to warn about. Once a message is
  // spent — or the thread holds any — the meter is on screen before the cap is (§7.16).
  const metered = !firstRun || used > 0;

  // A new turn — sent or streamed to completion — brings the end of the thread into view.
  const count = messages.length;
  useEffect(() => {
    if (count > 0) scrollRef.current?.scrollToEnd({ animated: !reduced });
  }, [count, reduced]);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || send.isPending || streaming || spent) return;
    send.mutate(
      { text: trimmed, ...(attached ? { resumeId: attached.id } : {}) },
      { onSuccess: () => setDraft('') },
    );
  };

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(!conversation.isPending && !subscription.isPending);

  // The sheet's rows lead with the page in a bordered tile, as INTERVIEW 03 draws them.
  const thumb = (
    <View
      style={[
        styles.sheetThumb,
        {
          backgroundColor: colors.surfaceCard,
          borderWidth: sizes.border,
          borderColor: colors.borderDefault,
        },
      ]}
    >
      <ResumeThumbnail style={styles.fill} />
    </View>
  );

  const page = (children: ReactNode, footer?: ReactNode, toContent = HEADER_TO_USAGE) => (
    <>
      <Screen
        wash
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="AI assistant" onBack={actions.goBack} trailing={<AiPill />} />}
        headerStyle={{ paddingBottom: s(toContent / 0.75) }}
        footer={footer}
        scrollRef={scrollRef}
        // A reply grows a line at a time while it streams; keep its end in view.
        followEnd={streaming}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
      >
        {children}
      </Screen>
      {/* A sibling of the page, never a child of its scroller. */}
      <OptionSheet
        open={sheetOpen}
        title="Ask about a resume"
        variant="card"
        options={documents.map<SheetOption>((item) => ({
          key: item.id,
          label: item.title,
          caption: docSubtitle(item),
          leading: thumb,
        }))}
        selectedKey={attached?.id}
        onSelect={(id) => {
          setAttachedId(id);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
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
        <Skeleton height={s(56 / 0.75)} radius="card" />
        <Skeleton height={s(44 / 0.75)} radius="card" width="70%" style={styles.end} />
        <Skeleton height={s(120 / 0.75)} radius="card" width="80%" />
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
    // §13.5: at zero the composer is REPLACED by the upsell, not overlaid. The label stays.
    <StickyActionBar
      floating
      note={ASSISTANT_DISCLAIMER}
      primary={{ label: 'See Pro plans', onPress: actions.openUpgrade }}
    />
  ) : (
    <DraftComposer
      onSend={ask}
      busy={send.isPending || streaming}
      failed={send.isError}
      onAttach={documents.length > 0 ? () => setSheetOpen(true) : undefined}
      attachedTitle={attached?.title}
      onDetach={() => setAttachedId(undefined)}
    />
  );

  // §7.16's meter, in the cap's own period, before the cap is hit.
  const meter = metered ? (
    <Animated.View entering={enter(0)}>
      <AssistantUsage used={used} limit={limit} />
    </Animated.View>
  ) : null;

  if (firstRun) {
    return page(
      <>
        {meter}
        <Animated.View entering={enter(1)} style={metered ? styles.afterMeter : null}>
          <FlowHero
            title={FIRST_RUN_TITLE}
            lede={FIRST_RUN_LEDE}
            art={FLOW_ART.assistantFirstRun}
            titleWidth={TITLE_WIDTH}
            ledeWidth={LEDE_WIDTH}
          />
        </Animated.View>
        {!spent ? (
          <Animated.View entering={enter(2)} style={styles.heroPrompts}>
            <SuggestedPrompts centred onPick={setDraft} />
          </Animated.View>
        ) : null}
      </>,
      footer,
      metered ? HEADER_TO_USAGE : HEADER_TO_ART,
    );
  }

  return page(
    <>
      {meter}
      <View style={[styles.thread, styles.afterMeter]}>
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
              // A sent turn arrives; a settled reply is swapping in for its streaming copy.
              enter={message.role === 'user'}
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
      </View>

      {/* Nothing here when the cap is spent: the meter above already says "0 of 20 left today"
          and the bar below says what Pro does about it. */}
      {!spent && draftEmpty && !streaming ? (
        <View style={styles.threadPrompts}>
          <SuggestedPrompts onPick={setDraft} />
        </View>
      ) : null}
    </>,
    footer,
  );
}

const useStyles = scaledSheet((s) => ({
  thread: { gap: s(TURN_GAP / 0.75) },
  end: { alignSelf: 'flex-end' },
  afterMeter: { marginTop: s(USAGE_TO_THREAD / 0.75) },
  heroPrompts: { marginTop: s(HERO_TO_PROMPTS / 0.75) },
  threadPrompts: { marginTop: s(THREAD_TO_PROMPTS / 0.75) },
  sheetThumb: {
    width: s(SHEET_THUMB / 0.75),
    height: s(SHEET_THUMB / 0.75),
    borderRadius: s(SHEET_THUMB_RADIUS / 0.75),
    overflow: 'hidden',
  },
  fill: { flex: 1 },
}));
