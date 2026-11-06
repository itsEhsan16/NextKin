import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { SUPPORT_TOPIC_LABEL, SUPPORT_TOPIC_ORDER, type SupportTopic } from '@/data/models';
import { useCurrentUser, useSubmitTicket } from '@/data/queries';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import { useTheme } from '@/theme';
import { OptionSheet, type SheetOption } from '@/ui/OptionSheet';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { ContactForm, ContactFormSkeleton } from '../components/ContactForm';
import { SupportHero } from '../components/SupportHero';
import {
  contactSentMessage,
  contactTopic,
  CONTACT_CTA,
  CONTACT_DONE,
  CONTACT_ERROR_MESSAGE,
  CONTACT_ERROR_TITLE,
  CONTACT_LEDE,
  CONTACT_SEND_FAILED,
  CONTACT_SENT_TITLE,
  CONTACT_TITLE,
  CONTACT_TOPIC_SHEET,
  validateContactMessage,
} from '../contactForm';
import { useSupportActions } from '../hooks/useSupportActions';

// SUPPORT 02 at 390 (577:7867), in artboard units.
const HEADER_TO_HERO = 14 / 0.75;
const HERO_ART_W = 64 / 0.75;
const ART_TO_TITLE = 14 / 0.75;
const TITLE_TO_LEDE = 8 / 0.75;
const HERO_TO_CARDS = 24 / 0.75;

export type ContactScreenProps = {
  /** Raw URL string: the help screen passes a SupportTopic, a deep link can pass anything. */
  topic?: string;
};

/**
 * CONTACT — write to support, drawn as SUPPORT 02 (577:7867) and entered from the Support rows on
 * PROFILE 02 (the spec has no section for it): a hero with the reply window, a topic card over a
 * sheet, the account address read-only, the message card, and the pinned Send bar every form in
 * the app wears.
 *
 * Sending is deliberately NOT optimistic. A support message that showed "Sent" and then failed
 * is the one failure this form must never have, so the confirmation waits for the server.
 *
 * The confirmation is an IN-SCREEN success state, not a toast: the profile toast host is not
 * mounted above a pushed screen, and popping straight back would leave the reader on the page
 * behind wondering whether anything happened. The success state names the address the reply goes
 * to and its "Done" button is the pop — one press, and never a Send that appears to do nothing.
 */
export function ContactScreen({ topic }: ContactScreenProps) {
  const { spacing, s } = useTheme();
  const { goBack } = useSupportActions();
  const user = useCurrentUser();
  const submit = useSubmitTicket();

  const [chosen, setChosen] = useState<SupportTopic>(() => contactTopic(topic));
  const [message, setMessage] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  // Errors surface on blur or after a refused Send, never while the first sentence is typed.
  const [showError, setShowError] = useState(false);

  const check = validateContactMessage(message);
  const error = showError && !check.ok ? check.error : undefined;

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the failure is announced
  // explicitly as well — once per falsy→truthy turn, the way TextField announces its error.
  const failed = submit.isError;
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(CONTACT_SEND_FAILED);
  }, [failed]);

  /**
   * Send is never `disabled`: a disabled button gives a screen reader no reason and gives anyone
   * else a control that sits inert. Pressing it while the message is too short refuses the send
   * and says what is missing on the field, which announces itself.
   */
  const send = () => {
    const ready = validateContactMessage(message);
    if (!ready.ok) {
      setShowError(true);
      return;
    }
    submit.mutate({ topic: chosen, message: ready.message });
  };

  // The hero stands in every state — the header row leaves its title slot empty — but the reply
  // window under it is only said while there is a form: the sent state says it in its own words,
  // and a page that cannot read the account must not promise a reply to it.
  const page = (children: ReactNode, footer?: ReactNode, lede = true) => (
    <View style={styles.root}>
      <Screen
        wash
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={CONTACT_TITLE} showTitle={false} onBack={goBack} />}
        headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={footer}
      >
        <SupportHero
          art={PROFILE_ROW_ART.contact}
          artWidth={HERO_ART_W}
          artGap={ART_TO_TITLE}
          title={CONTACT_TITLE}
        >
          {lede ? (
            <Text
              variant="captionRegular"
              color="textSecondary"
              align="center"
              style={{ marginTop: s(TITLE_TO_LEDE) }}
            >
              {CONTACT_LEDE}
            </Text>
          ) : null}
        </SupportHero>
        <View style={{ marginTop: s(HERO_TO_CARDS) }}>{children}</View>
      </Screen>

      {/* Sibling of the page, never a child of its scroller: its root is an absolute fill. */}
      <OptionSheet<SupportTopic>
        open={sheetOpen}
        title={CONTACT_TOPIC_SHEET}
        options={SUPPORT_TOPIC_ORDER.map<SheetOption<SupportTopic>>((value) => ({
          key: value,
          label: SUPPORT_TOPIC_LABEL[value],
        }))}
        selectedKey={chosen}
        onSelect={(value) => {
          setChosen(value);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a footer out of nothing the moment the account lands.
  if (user.isPending) {
    return page(
      <ContactFormSkeleton />,
      <StickyActionBar primary={{ label: CONTACT_CTA, disabled: true }} />,
    );
  }

  // A form that cannot read the account address cannot promise a reply to it, so this is an
  // error rather than a second field asking for one.
  if (user.isError || !user.data) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title={CONTACT_ERROR_TITLE}
        message={CONTACT_ERROR_MESSAGE}
        actionLabel="Try again"
        onAction={() => void user.refetch()}
      />,
      undefined,
      false,
    );
  }

  const email = user.data.email;

  if (submit.isSuccess) {
    return page(
      <StateView icon="Send01" title={CONTACT_SENT_TITLE} message={contactSentMessage(email)} />,
      <StickyActionBar primary={{ label: CONTACT_DONE, onPress: goBack }} />,
      false,
    );
  }

  return page(
    <ContactForm
      topic={chosen}
      onPickTopic={() => setSheetOpen(true)}
      email={email}
      name={`${user.data.firstName} ${user.data.lastName}`.trim()}
      {...(user.data.avatarUrl ? { avatarUrl: user.data.avatarUrl } : {})}
      message={message}
      onChangeMessage={setMessage}
      onBlurMessage={() => setShowError(true)}
      {...(error ? { error } : {})}
    />,
    // One line, and only the failure: the field already says what is missing, and repeating the
    // validation reason down here would say it twice.
    <StickyActionBar
      {...(failed ? { note: CONTACT_SEND_FAILED } : {})}
      primary={{
        label: CONTACT_CTA,
        icon: 'Send01',
        loading: submit.isPending,
        onPress: send,
      }}
    />,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
