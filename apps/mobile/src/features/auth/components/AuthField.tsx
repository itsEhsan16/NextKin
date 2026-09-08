import { useRef, useState, type ReactElement } from 'react';
import { TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import RevealOnIcon from '../../../../assets/icons/onboarding/field-reveal-on.svg';
import RevealIcon from '../../../../assets/icons/onboarding/field-reveal.svg';
import { board } from '../board';
import { SIGN_UP } from '../signUpLayout';
import { hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { useRevealOnFocus } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export type AuthFieldProps = {
  /** Doubles as the placeholder: the board draws no label above the box. */
  label: string;
  /** The board's own glyph, invoked inline rather than passed as a component. */
  renderIcon: (props: SvgProps) => ReactElement;
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
  ref?: React.Ref<TextInput>;
};

/**
 * A sign-up field (Figma 296:3145).
 *
 * `src/ui/TextField` is the app's text-entry primitive and stays so; this is a different control
 * — outlined rather than filled, a leading glyph, and the label carried by the placeholder
 * instead of a line above the box — so it is built here against its artboard rather than by
 * bending the primitive into a second shape for one screen. If auth gains another designed form,
 * the two should be folded together as a TextField variant. See toreview.md.
 *
 * The error row is always rendered once there is anything to say, so a message swaps in rather
 * than pushing the form down — the behaviour `TextField` established.
 */
export function AuthField({
  label,
  renderIcon,
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
  const fieldRef = useRef<View>(null);

  const glyph = s(board(SIGN_UP.fieldIcon));

  return (
    // Measured whole, error row included, so the reveal lifts the message with the box.
    <View ref={fieldRef}>
      <View
        style={[
          styles.box,
          {
            height: s(board(SIGN_UP.fieldHeight)),
            paddingHorizontal: s(board(SIGN_UP.fieldPadding)),
            borderRadius: s(board(SIGN_UP.fieldRadius)),
            borderWidth: s(board(SIGN_UP.hairline)),
            borderColor: error ? colors.danger : colors.authFieldBorder,
          },
        ]}
      >
        <View style={{ marginRight: s(board(SIGN_UP.fieldIconGap)) }}>
          {renderIcon({ width: glyph, height: glyph })}
        </View>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          onFocus={() => revealOnFocus?.(fieldRef.current)}
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
            {revealed ? (
              <RevealOnIcon width={glyph} height={glyph} />
            ) : (
              <RevealIcon width={glyph} height={glyph} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          variant="authMeta"
          color="danger"
          accessibilityLiveRegion="polite"
          style={{ marginTop: s(board(SIGN_UP.fieldErrorGap)) }}
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
