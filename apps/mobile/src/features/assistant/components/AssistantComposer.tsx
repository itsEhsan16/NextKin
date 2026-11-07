import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { a11yButton, hitSlopFor, maxFontScale } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
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
  /** The paperclip: picks which resume the answers use. Absent when there is none to pick. */
  onPickContext?: () => void;
  /** The resume the answers will use, shown as a chip over the pill. */
  contextTitle?: string;
  /** Stops using it: answers become general. */
  onClearContext?: () => void;
};

export const ASSISTANT_MESSAGE_MAX = 500;
/** The one line under the bar (owner, 2026-11-08, §189). */
export const ASSISTANT_LABEL = 'AI-generated guidance';
const SEND_FAILED = "That didn't send. Check your connection and try again.";
const PLACEHOLDER = 'Ask a question…';

/**
 * The pinned chat bar (ASSISTANT 01 / 02, kept by the owner on 2026-11-08, §189): one white pill
 * — the paperclip, the field and the round brand send — floating with no bar behind it, the
 * resume in use as a chip over it, and "AI-generated guidance" under it. The `Screen` footer, so
 * it rides the keyboard frame by frame.
 */
export function AssistantComposer({
  value,
  onChange,
  onSend,
  busy,
  failed,
  disabled = false,
  onPickContext,
  contextTitle,
  onClearContext,
}: AssistantComposerProps) {
  const { colors, opacity, radii, shadows, sizes, spacing, typography, s, u } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const ready = value.trim().length > 0 && !busy && !disabled;

  return (
    <View
      style={[
        styles.root,
        { paddingHorizontal: spacing.gutter, paddingBottom: spacing[4] + insets.bottom },
      ]}
    >
      {contextTitle ? (
        <View
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
          <Pressable
            {...a11yButton(`Using ${contextTitle}`, 'Choose which resume the answers use')}
            feedback="subtle"
            disabled={!onPickContext}
            onPress={onPickContext}
            style={styles.chipLabel}
          >
            <Text variant="caption" color="textBody" numberOfLines={1} style={styles.chipText}>
              {`Using ${contextTitle}`}
            </Text>
          </Pressable>
          {onClearContext ? (
            <Pressable
              {...a11yButton('Stop using this resume', 'Answers will be general')}
              feedback="scale"
              hitSlop={hitSlopFor(u(20))}
              onPress={onClearContext}
            >
              <Icon name="XClose" size="xs" color={colors.iconMuted} />
            </Pressable>
          ) : null}
        </View>
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
          {...a11yButton('Choose a resume', 'Answers will use the resume you pick')}
          feedback="scale"
          hitSlop={hitSlopFor(s(17 / 0.75))}
          disabled={disabled || !onPickContext}
          onPress={onPickContext}
          style={[styles.clip, disabled || !onPickContext ? { opacity: opacity.disabled } : null]}
        >
          <Icon name="Paperclip" size="md" color={colors.textSecondary} />
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
            { color: colors.textPrimary, maxHeight: s((4 * 20) / 0.75) },
          ]}
        />
        <Pressable
          {...a11yButton(busy ? 'Sending' : 'Send')}
          accessibilityState={{ disabled: !ready, busy }}
          feedback="scale"
          disabled={!ready}
          onPress={onSend}
          style={[
            styles.send,
            ready ? shadows.composerSend : null,
            { backgroundColor: colors.brand, opacity: ready ? 1 : opacity.disabled },
          ]}
        >
          <Icon name="Send01" size="sm" color={colors.textOnBrand} />
        </Pressable>
      </View>

      {failed ? (
        <Text variant="caption" color="danger" align="center" accessibilityLiveRegion="polite">
          {SEND_FAILED}
        </Text>
      ) : null}
      <AssistantLabel />
    </View>
  );
}

/** "AI-generated guidance" with its info mark: under the bar, and under the upsell at zero. */
export function AssistantLabel() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.label}>
      <Icon name="InfoCircle" size="sm" color={colors.iconMuted} />
      <Text variant="micro" color="textSecondary">
        {ASSISTANT_LABEL}
      </Text>
    </View>
  );
}

// ASSISTANT 01 / 02 at 390 (577:6569 / 577:7855, the pill 675:2), in artboard units.
const useStyles = scaledSheet((s) => ({
  root: { paddingTop: s(10 / 0.75), gap: s(12 / 0.75) },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12 / 0.75),
    minHeight: s(56 / 0.75),
    borderRadius: s(28 / 0.75),
    paddingLeft: s(18 / 0.75),
    paddingRight: s(6 / 0.75),
    paddingVertical: s(6 / 0.75),
  },
  // Both ends sit on the last line's 44 band, so a wrapped question grows the pill upwards only.
  clip: { height: s(44 / 0.75), justifyContent: 'center', alignSelf: 'flex-end' },
  input: { flex: 1, padding: 0, margin: 0, includeFontPadding: false },
  send: {
    width: s(44 / 0.75),
    height: s(44 / 0.75),
    borderRadius: s(44 / 0.75) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: s(27 / 0.75),
    gap: s(6 / 0.75),
    paddingHorizontal: s(10 / 0.75),
  },
  chipLabel: { flexShrink: 1 },
  chipText: { flexShrink: 1 },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(7 / 0.75),
  },
}));
