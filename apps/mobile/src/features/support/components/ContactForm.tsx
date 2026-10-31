import { View } from 'react-native';

import { SUPPORT_MESSAGE_MAX, SUPPORT_TOPIC_LABEL, type SupportTopic } from '@/data/models';
import { SectionCard } from '@/features/profile/components/cards';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import { scaledSheet, useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { SelectField } from '@/ui/SelectField';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import {
  CONTACT_EMAIL_CAPTION,
  CONTACT_EMAIL_GROUP,
  CONTACT_MESSAGE_LABEL,
  CONTACT_MESSAGE_PLACEHOLDER,
  CONTACT_TOPIC_HINT,
  CONTACT_TOPIC_LABEL,
  CONTACT_TOPIC_SHEET,
} from '../contactForm';

// SUPPORT 02 at 390 (577:7892 … 577:7965), in artboard units.
/** Card → card (577:7919); one point looser than the profile editors' 14. */
const CARD_SPACING = 15 / 0.75;
const AVATAR = 40 / 0.75;
const ADDRESS_GAP = 12 / 0.75;
const ADDRESS_TEXT_GAP = 2 / 0.75;
/** The textarea is 126 tall on the board (577:7966): five lines of body copy and its insets. */
const MESSAGE_LINES = 5;

export type ContactFormProps = {
  topic: SupportTopic;
  onPickTopic: () => void;
  /** The account address. Shown, never asked for — the repo attaches this one either way. */
  email: string;
  /** The account's name and photo, for the avatar beside the address (577:7938). */
  name: string;
  avatarUrl?: string;
  message: string;
  onChangeMessage: (value: string) => void;
  onBlurMessage: () => void;
  /** Surfaced on blur or after a refused Send, never on the first keystroke. */
  error?: string;
};

/**
 * The contact form's three cards, as SUPPORT 02 draws them (577:7892, 577:7920, 577:7943): the
 * topic over a picker, the address the reply goes to beside the account's avatar, and the message.
 * Each card's titled header carries the field's name, so the fields inside draw no label of their
 * own — they still speak one.
 */
export function ContactForm({
  topic,
  onPickTopic,
  email,
  name,
  avatarUrl,
  message,
  onChangeMessage,
  onBlurMessage,
  error,
}: ContactFormProps) {
  const { s } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.cards}>
      <SectionCard
        art={PROFILE_ROW_ART.help}
        title={CONTACT_TOPIC_LABEL}
        subtitle={CONTACT_TOPIC_SHEET}
      >
        <SelectField
          label={CONTACT_TOPIC_LABEL}
          showLabel={false}
          icon="Tag01"
          value={SUPPORT_TOPIC_LABEL[topic]}
          hint={CONTACT_TOPIC_HINT}
          onPress={onPickTopic}
        />
      </SectionCard>

      <SectionCard art={PROFILE_ROW_ART.emailPassword} artWidth={28} title={CONTACT_EMAIL_GROUP}>
        {/* Static, so it is one accessible element rather than a row a reader tries to press. */}
        <View
          accessible
          accessibilityLabel={`${email}. ${CONTACT_EMAIL_CAPTION}`}
          style={styles.address}
        >
          <Avatar source={avatarUrl} name={name} size={s(AVATAR)} />
          <View style={styles.addressText}>
            <Text variant="menuRow" numberOfLines={1}>
              {email}
            </Text>
            <Text variant="micro" color="textSecondary">
              {CONTACT_EMAIL_CAPTION}
            </Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard art={PROFILE_ROW_ART.terms} title={CONTACT_MESSAGE_LABEL}>
        <TextField
          accessibilityLabel={CONTACT_MESSAGE_LABEL}
          placeholder={CONTACT_MESSAGE_PLACEHOLDER}
          {...(error ? { error } : {})}
          value={message}
          onChangeText={onChangeMessage}
          onBlur={onBlurMessage}
          multiline
          minLines={MESSAGE_LINES}
          maxLength={SUPPORT_MESSAGE_MAX}
          showCount
          testID="contact-message"
        />
      </SectionCard>
    </View>
  );
}

/** The three cards' heights on the board (577:7892 / 577:7920 / 577:7943). */
const CARD_HEIGHTS = [128.5 / 0.75, 111.5 / 0.75, 219.5 / 0.75] as const;

/**
 * The loading state. Blocks in the shape of the cards that replace them, so nothing jumps when
 * the account lands — and the screen pins an inert action bar under it, because the bar owns the
 * bottom safe-area inset.
 */
export function ContactFormSkeleton() {
  const styles = useStyles();
  const { s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading the contact form" style={styles.cards}>
      {CARD_HEIGHTS.map((height) => (
        <Skeleton key={height} height={s(height)} radius="cardLg" />
      ))}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  cards: { gap: s(CARD_SPACING) },
  address: { flexDirection: 'row', alignItems: 'center', gap: s(ADDRESS_GAP) },
  addressText: { flex: 1, gap: s(ADDRESS_TEXT_GAP) },
}));
