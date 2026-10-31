import { useRef, useState } from 'react';
import {
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
  type ViewInstance,
  type TextInputInstance,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { board } from '../board';
import { hitSlopFor, maxFontScale } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { useRevealOnFocus } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { useFieldChrome } from '@/ui/TextField';

/**
 * The drawn box, as the using screen's board draws it. `SIGN_UP` and `SIGN_IN` both satisfy this
 * shape, and they disagree on every member of it — see the note at the top of `signInLayout.ts`.
 */
export type AuthFieldMetrics = {
  fieldHeight: number;
  fieldRadius: number;
  fieldPadding: number;
  fieldIcon: number;
  fieldIconGap: number;
  fieldErrorGap: number;
  hairline: number;
};

export type AuthFieldProps = {
  /** Doubles as the placeholder: the board draws no label above the box. */
  label: string;
  metrics: AuthFieldMetrics;
  /** The leading glyph, from the line set the rest of the app draws with. */
  icon: LineIconName;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmit?: () => void;
  ref?: React.Ref<TextInputInstance>;
};

/**
 * An auth field — sign-up (Figma 307:4395) and sign-in (309:294), which draw it slightly
 * differently, so the box comes in as `metrics` rather than being read off one of them.
 *
 * It keeps its artboard's shape — outlined rather than filled, a leading glyph, and the label
 * carried by the placeholder instead of a line above the box — but not its own behaviour: focus,
 * error and announcement come from `useFieldChrome`, the same as `TextField`, so a tap on an
 * auth box lands visibly and a validation failure is said out loud (toreview.md §140).
 *
 * The error row is always rendered once there is anything to say, so a message swaps in rather
 * than pushing the form down — the behaviour `TextField` established.
 */
export function AuthField({
  label,
  metrics,
  icon,
  value,
  onChangeText,
  onBlur,
  error,
  secure = false,
  keyboardType,
  autoComplete,
  autoCapitalize = 'none',
  returnKeyType,
  onSubmit,
  ref,
}: AuthFieldProps) {
  const { colors, typography, s } = useTheme();
  const styles = useStyles();
  const [revealed, setRevealed] = useState(false);
  // The page scrolls a focused field clear of the keyboard, exactly as it does for TextField.
  // Skipping this is what left the email and password boxes under the keyboard on device.
  const revealOnFocus = useRevealOnFocus();
  const fieldRef = useRef<ViewInstance>(null);

  const glyph = s(board(metrics.fieldIcon));
  const chrome = useFieldChrome(error, { rest: colors.authFieldBorder });

  return (
    // Measured whole, error row included, so the reveal lifts the message with the box.
    <View ref={fieldRef}>
      <Animated.View
        style={[
          styles.box,
          {
            height: s(board(metrics.fieldHeight)),
            paddingHorizontal: s(board(metrics.fieldPadding)),
            borderRadius: s(board(metrics.fieldRadius)),
            borderWidth: s(board(metrics.hairline)),
          },
          chrome.borderStyle,
        ]}
      >
        <View style={{ marginRight: s(board(metrics.fieldIconGap)) }}>
          <Icon name={icon} size={glyph} color={colors.iconMuted} />
        </View>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onBlur={() => {
            chrome.onBlur();
            onBlur?.();
          }}
          onFocus={() => {
            chrome.onFocus();
            revealOnFocus?.(fieldRef.current);
          }}
          placeholder={label}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={label}
          secureTextEntry={secure && !revealed}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmit}
          submitBehavior={returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
          selectionColor={colors.textPrimary}
          cursorColor={colors.textPrimary}
          maxFontSizeMultiplier={maxFontScale.body}
          style={[styles.input, typography.authField, { color: colors.textPrimary }]}
        />
        {secure ? (
          <Pressable
            feedback="subtle"
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={hitSlopFor(glyph)}
            onPress={() => setRevealed((shown) => !shown)}
          >
            {/* Struck through while the password is masked, which is the state the board draws. */}
            <Icon name={revealed ? 'Eye' : 'EyeOff'} size={glyph} color={colors.iconMuted} />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <Text
          variant="authMeta"
          color="danger"
          accessibilityLiveRegion="polite"
          style={{ marginTop: s(board(metrics.fieldErrorGap)) }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  box: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, padding: 0 },
}));
