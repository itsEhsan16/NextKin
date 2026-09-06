import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { SUPPORT_MESSAGE_MAX, SUPPORT_TOPIC_LABEL, type SupportTopic } from '@/data/models';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { ListRow, RowGroup } from '@/ui/ListRow';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import {
  CONTACT_EMAIL_CAPTION,
  CONTACT_EMAIL_GROUP,
  CONTACT_LEDE,
  CONTACT_MESSAGE_HELPER,
  CONTACT_MESSAGE_LABEL,
  CONTACT_MESSAGE_PLACEHOLDER,
  CONTACT_TOPIC_GROUP,
  CONTACT_TOPIC_HINT,
  CONTACT_TOPIC_LABEL,
} from '../contactForm';

/** ListRow's own metrics, so the read-only row lines up with the pressable one above it. */
const ICON = 16;
const ICON_SLOT = 20;
const PADDING_X = 20;
const GUTTER = 16;
/** Six lines of body copy: enough room to describe a problem without scrolling the field. */
const MESSAGE_LINES = 6;

export type ContactFormProps = {
  topic: SupportTopic;
  onPickTopic: () => void;
  /** The account address. Shown, never asked for — the repo attaches this one either way. */
  email: string;
  message: string;
  onChangeMessage: (value: string) => void;
  onBlurMessage: () => void;
  /** Surfaced on blur or after a refused Send, never on the first keystroke. */
  error?: string;
};

/**
 * The contact form's fields (V2 §7.14). No artboard draws them (plan §8, phase 9G), so the page
 * is grouped rows plus one textarea, exactly as the profile forms are.
 */
export function ContactForm({
  topic,
  onPickTopic,
  email,
  message,
  onChangeMessage,
  onBlurMessage,
  error,
}: ContactFormProps) {
  const { colors, spacing, sizes, s } = useTheme();
  const styles = useStyles();

  return (
    <>
      <Text variant="prose" color="textSecondary">
        {CONTACT_LEDE}
      </Text>

      <RowGroup title={CONTACT_TOPIC_GROUP}>
        <ListRow
          icon="tag"
          label={CONTACT_TOPIC_LABEL}
          value={SUPPORT_TOPIC_LABEL[topic]}
          accessibilityLabel={`${CONTACT_TOPIC_LABEL}, ${SUPPORT_TOPIC_LABEL[topic]}`}
          accessibilityHint={CONTACT_TOPIC_HINT}
          onPress={onPickTopic}
        />
      </RowGroup>

      <View style={{ gap: spacing[2] }}>
        <Text variant="overline" color="textSecondary" accessibilityRole="header">
          {CONTACT_EMAIL_GROUP}
        </Text>
        <Card radius="card" padding={0}>
          {/* Static, so it is one accessible element rather than a row a reader tries to press. */}
          <View
            accessible
            accessibilityLabel={`${email}. ${CONTACT_EMAIL_CAPTION}`}
            style={[
              styles.row,
              {
                minHeight: sizes.listRow,
                paddingHorizontal: s(PADDING_X),
                paddingVertical: spacing[3],
                gap: s(GUTTER),
              },
            ]}
          >
            <View style={[styles.iconSlot, { width: s(ICON_SLOT) }]}>
              <FontAwesome5 name="envelope" size={s(ICON)} color={colors.iconDefault} solid />
            </View>
            <View style={styles.rowText}>
              <Text variant="rowTitle" numberOfLines={1}>
                {email}
              </Text>
              <Text variant="rowDescription" color="textSecondary">
                {CONTACT_EMAIL_CAPTION}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <TextField
        label={CONTACT_MESSAGE_LABEL}
        placeholder={CONTACT_MESSAGE_PLACEHOLDER}
        helper={CONTACT_MESSAGE_HELPER}
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
    </>
  );
}

/** The composed heights of the blocks above: the lede, the two rows and the textarea. */
const LEDE = 75;
const LABEL = 20;
const ROW = 60;
const MESSAGE = 190;

/**
 * The loading state. Blocks in the shape of the content that replaces them, so nothing jumps
 * when the account lands — and the screen pins an inert action bar under it, because the bar
 * owns the bottom safe-area inset.
 */
export function ContactFormSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading the contact form" style={{ gap: spacing[5] }}>
      <Skeleton height={s(LEDE)} />
      <View style={{ gap: spacing[2] }}>
        <Skeleton width="30%" height={s(LABEL)} />
        <Skeleton height={s(ROW)} radius="card" />
      </View>
      <View style={{ gap: spacing[2] }}>
        <Skeleton width="45%" height={s(LABEL)} />
        <Skeleton height={s(ROW)} radius="card" />
      </View>
      <View style={{ gap: spacing[2] }}>
        <Skeleton width="35%" height={s(LABEL)} />
        <Skeleton height={s(MESSAGE)} radius="xl" />
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconSlot: { alignItems: 'center' },
  rowText: { flex: 1, gap: s(2) },
}));
