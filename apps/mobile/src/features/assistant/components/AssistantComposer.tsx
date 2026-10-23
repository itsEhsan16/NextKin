import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ASSISTANT_DISCLAIMER } from '@/data/models';
import { a11yButton, hitSlopFor, maxFontScale } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type AssistantComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** A turn is being sent, or a reply is still being written: one question at a time. */
  busy: boolean;
  /** The last send did not reach the assistant at all (distinct from a reply that stopped). */
  failed: boolean;
  disabled?: boolean;
  /** The paperclip: picks a resume for the answers to refer to (§7.16's context awareness). */
  onAttach?: () => void;
  /** The resume attached as context, shown as a chip over the pill. */
  attachedTitle?: string;
  onDetach?: () => void;
};

export const ASSISTANT_MESSAGE_MAX = 500;
const SEND_FAILED = "That didn't send. Check your connection and try again.";
const PLACEHOLDER = 'Ask a question…';

// ASSISTANT 01 / 02 at 390 (577:6569 / 577:7855, the pill 675:2), in artboard units.
const PAD_TOP = 10;
const PILL_MIN_H = 56;
const PILL_RADIUS = 28;
const PILL_PAD_LEFT = 18;
const PILL_PAD_RIGHT = 6;
const PILL_PAD_Y = 6;
const PILL_GAP = 12;
const CLIP = 17;
const SEND = 44;
const SEND_GLYPH = 15;
const STACK_GAP = 12; // 577:7855's gap, pill → label
const INFO = 12;
const INFO_GAP = 7;
const CHIP_H = 27; // the removable chip at 390: 6 + 15 + 6
const CHIP_PAD_X = 10;
const CHIP_GAP = 6;
const CHIP_GLYPH = 7;
/** Four lines, then the field scrolls inside the pill. */
const INPUT_MAX_H = 4 * 20;

/**
 * The pinned composer (V2 §7.16, ASSISTANT 01 / 02): one white pill — the paperclip, the field and
 * the round send — floating with no bar behind it, and the §7.16 label under it, so the label is
 * on screen whatever the transcript is scrolled to. Rides up with the keyboard as the `Screen`'s
 * footer, frame by frame; the keys slide over its bottom inset strip, so no dead band is left
 * between the composer and the keyboard (`KeyboardFrame`). The paperclip attaches a resume as context, never a file: the assistant reads and
 * advises, and what it can read is the reader's own NextKin documents.
 */
export function AssistantComposer({
  value,
  onChange,
  onSend,
  busy,
  failed,
  disabled = false,
  onAttach,
  attachedTitle,
  onDetach,
}: AssistantComposerProps) {
  const { colors, opacity, radii, shadows, sizes, spacing, typography, s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const ready = value.trim().length > 0 && !busy && !disabled;

  return (
    <View
      style={[
        styles.root,
        {
          paddingHorizontal: spacing.gutter,
          // `Screen` hands the bottom safe area to its footer, as `StickyActionBar` takes it.
          paddingBottom: spacing[4] + insets.bottom,
        },
      ]}
    >
      {attachedTitle ? (
        // The applied-filter chip's look (Figma 1:289), named for what it does here.
        <Pressable
          {...a11yButton(`Asking about ${attachedTitle}`, 'Removes the resume from the question')}
          feedback="subtle"
          haptic="selection"
          hitSlop={hitSlopFor(s(CHIP_H / 0.75))}
          onPress={() => onDetach?.()}
          style={[
            styles.chip,
            {
              borderRadius: radii.full,
              borderWidth: sizes.border,
              borderColor: colors.borderDefault,
              backgroundColor: colors.surfaceCard,
            },
          ]}
        >
          <Text variant="caption" color="textBody" numberOfLines={1} style={styles.chipText}>
            {`About: ${attachedTitle}`}
          </Text>
          <FontAwesome5 name="times" size={s(CHIP_GLYPH / 0.75)} color={colors.iconMuted} solid />
        </Pressable>
      ) : null}

      <View
        style={[
          styles.pill,
          shadows.composer,
          {
            backgroundColor: colors.surfaceCard,
            borderWidth: s(1 / 0.75),
            borderColor: colors.borderDefault,
          },
        ]}
      >
        <Pressable
          {...a11yButton('Attach a resume', 'Answers will refer to the resume you pick')}
          feedback="scale"
          haptic="light"
          hitSlop={hitSlopFor(s(CLIP / 0.75))}
          disabled={disabled || !onAttach}
          onPress={onAttach}
          style={[styles.clip, disabled ? { opacity: opacity.disabled } : null]}
        >
          <FontAwesome5 name="paperclip" size={s(CLIP / 0.75)} color={colors.textSecondary} solid />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={PLACEHOLDER}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.textPrimary}
          cursorColor={colors.textPrimary}
          accessibilityLabel="Message"
          accessibilityState={{ disabled }}
          multiline
          maxLength={ASSISTANT_MESSAGE_MAX}
          editable={!disabled}
          submitBehavior="newline"
          maxFontSizeMultiplier={maxFontScale.body}
          style={[
            styles.input,
            typography.menuRow,
            { color: colors.textPrimary, maxHeight: s(INPUT_MAX_H / 0.75) },
          ]}
        />
        <Pressable
          {...a11yButton(busy ? 'Sending' : 'Send')}
          accessibilityState={{ disabled: !ready, busy }}
          feedback="scale"
          haptic="light"
          disabled={!ready}
          onPress={onSend}
          style={[
            styles.send,
            ready ? shadows.composerSend : null,
            { backgroundColor: colors.brand, opacity: ready ? 1 : opacity.disabled },
          ]}
        >
          <FontAwesome5
            name="paper-plane"
            size={s(SEND_GLYPH / 0.75)}
            color={colors.textOnBrand}
            solid
          />
        </Pressable>
      </View>

      {failed ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {SEND_FAILED}
        </Text>
      ) : null}
      <View style={styles.label}>
        <FontAwesome5
          name="info-circle"
          size={s(INFO / 0.75)}
          color={colors.iconMuted}
          solid
          importantForAccessibility="no"
        />
        <Text variant="micro" color="textSecondary" style={styles.labelText}>
          {ASSISTANT_DISCLAIMER}
        </Text>
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  root: { paddingTop: s(PAD_TOP / 0.75), gap: s(STACK_GAP / 0.75) },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PILL_GAP / 0.75),
    minHeight: s(PILL_MIN_H / 0.75),
    borderRadius: s(PILL_RADIUS / 0.75),
    paddingLeft: s(PILL_PAD_LEFT / 0.75),
    paddingRight: s(PILL_PAD_RIGHT / 0.75),
    paddingVertical: s(PILL_PAD_Y / 0.75),
  },
  // Both ends sit on the last line's 44 band, so a wrapped question grows the pill upwards only.
  clip: { height: s(SEND / 0.75), justifyContent: 'center', alignSelf: 'flex-end' },
  input: { flex: 1, padding: 0, margin: 0, includeFontPadding: false },
  send: {
    width: s(SEND / 0.75),
    height: s(SEND / 0.75),
    borderRadius: s(SEND / 0.75) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: s(CHIP_H / 0.75),
    gap: s(CHIP_GAP / 0.75),
    paddingHorizontal: s(CHIP_PAD_X / 0.75),
  },
  chipText: { flexShrink: 1 },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(INFO_GAP / 0.75),
  },
  labelText: { flexShrink: 1 },
}));
