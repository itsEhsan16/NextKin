import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ASSISTANT_DISCLAIMER } from '@/data/models';
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
  /** Opens the "which resume should I use" picker. Absent when there is none to pick. */
  onPickContext?: () => void;
  /** The resume the answers will use, shown as a chip over the field. */
  contextTitle?: string;
  /** Stops using it: answers become general. */
  onClearContext?: () => void;
  /** Messages left today, said quietly under the field once any are spent (§13.5). */
  left?: number;
  limit?: number;
};

export const ASSISTANT_MESSAGE_MAX = 500;
const SEND_FAILED = "That didn't send. Check your connection and try again.";
const PLACEHOLDER = 'Ask about your resume, jobs, interviews…';

/**
 * The pinned composer (§188): the resume in use as a chip, then one rounded field with a "+"
 * (pick the resume) and a round send, then one quiet line: today's allowance and §7.16's label.
 * The `Screen` footer, so it rides the keyboard frame by frame.
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
  left,
  limit,
}: AssistantComposerProps) {
  const { colors, opacity, shadows, sizes, typography, u } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const ready = value.trim().length > 0 && !busy && !disabled;

  return (
    <View style={[styles.root, { paddingBottom: u(10) + insets.bottom }]}>
      {contextTitle ? (
        <View style={styles.chipRow}>
          <Pressable
            {...a11yButton(`Using ${contextTitle}`, 'Choose which resume the answers use')}
            feedback="subtle"
            haptic="selection"
            disabled={!onPickContext}
            onPress={onPickContext}
            style={[styles.chip, { backgroundColor: colors.brandSurface }]}
          >
            <Icon name="File04" size="xs" color={colors.brand} />
            <Text variant="footnote" color="brand" numberOfLines={1} style={styles.chipText}>
              {`Using ${contextTitle}`}
            </Text>
            <Icon name="ChevronDown" size="xs" color={colors.brand} />
          </Pressable>
          {onClearContext ? (
            <Pressable
              {...a11yButton('Stop using this resume', 'Answers will be general')}
              feedback="scale"
              haptic="selection"
              hitSlop={hitSlopFor(u(28))}
              onPress={onClearContext}
              style={[styles.chipClose, { backgroundColor: colors.surfaceSubtle }]}
            >
              <Icon name="XClose" size="xs" color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.pill,
          shadows.soft,
          {
            backgroundColor: colors.surfaceCard,
            borderWidth: sizes.border,
            borderColor: colors.borderDashed,
          },
        ]}
      >
        <Pressable
          {...a11yButton('Choose a resume', 'Answers will use the resume you pick')}
          feedback="scale"
          haptic="light"
          disabled={disabled || !onPickContext}
          onPress={onPickContext}
          style={[
            styles.round,
            { backgroundColor: colors.surfaceSubtle },
            disabled || !onPickContext ? { opacity: opacity.disabled } : null,
          ]}
        >
          <Icon name="Plus" size="sm" color={colors.ink} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={PLACEHOLDER}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.brand}
          cursorColor={colors.brand}
          accessibilityLabel="Message"
          accessibilityState={{ disabled }}
          multiline
          maxLength={ASSISTANT_MESSAGE_MAX}
          editable={!disabled}
          submitBehavior="newline"
          maxFontSizeMultiplier={maxFontScale.body}
          style={[
            styles.input,
            typography.bodyLg,
            { color: colors.textPrimary, maxHeight: u(22 * 5) },
          ]}
        />
        <Pressable
          {...a11yButton(busy ? 'Sending' : 'Send')}
          accessibilityState={{ disabled: !ready, busy }}
          feedback="scale"
          haptic="light"
          disabled={!ready}
          onPress={onSend}
          style={[styles.round, { backgroundColor: ready ? colors.brand : colors.surfaceSubtle }]}
        >
          <Icon name="ArrowUp" size="sm" color={ready ? colors.textOnBrand : colors.iconMuted} />
        </Pressable>
      </View>

      {failed ? (
        <Text variant="footnote" color="danger" align="center" accessibilityLiveRegion="polite">
          {SEND_FAILED}
        </Text>
      ) : null}
      <View style={styles.note}>
        {left != null && limit != null ? (
          <Text variant="footnote" color={left <= 3 ? 'warning' : 'textSecondary'}>
            {`${left} of ${limit} left today`}
          </Text>
        ) : null}
        <Text variant="footnote" color="textTertiary" align="center" style={styles.noteText}>
          {ASSISTANT_DISCLAIMER}
        </Text>
      </View>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  root: { paddingHorizontal: u(16), paddingTop: u(8), gap: u(8) },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: u(6),
    paddingHorizontal: u(12),
    paddingVertical: u(6),
    borderRadius: u(999),
  },
  chipText: { flexShrink: 1 },
  chipClose: {
    width: u(26),
    height: u(26),
    borderRadius: u(13),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: u(8),
    minHeight: u(56),
    borderRadius: u(28),
    padding: u(7),
  },
  round: {
    width: u(40),
    height: u(40),
    borderRadius: u(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    alignSelf: 'center',
    paddingHorizontal: u(4),
    paddingVertical: u(8),
    margin: 0,
    includeFontPadding: false,
  },
  note: { alignItems: 'center', gap: u(2) },
  noteText: { flexShrink: 1 },
}));
