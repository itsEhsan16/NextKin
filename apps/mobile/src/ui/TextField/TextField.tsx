import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { haptics, maxFontScale, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { useRevealOnFocus } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { useSelectionProgress } from '@/ui/motion';

export type TextFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  /** A quiet "Optional" after the label (Figma 577:5418 / 577:7481). */
  optional?: boolean;
  /** A unit set at the trailing edge of the box — "years" (Figma 577:5414). */
  suffix?: string;
  /**
   * A control inside the box at its end — a resume bullet's remove button (RESUMES 07 577:8663).
   * It is its own labelled target; the field does not describe it.
   */
  trailing?: ReactNode;
  placeholder?: string;
  helper?: string;
  /** Replaces the helper, paints the danger border and is announced once. */
  error?: string;
  /** Leading FontAwesome 5 Solid glyph, like SearchField's search icon. */
  icon?: string;
  multiline?: boolean;
  /** Multiline only: the floor in text lines; the box never shrinks below sizes.textArea. */
  minLines?: number;
  maxLength?: number;
  /** Live "12/200" counter; needs maxLength. */
  showCount?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  secureTextEntry?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  /** onSubmitEditing. Chain fields by focusing the next ref from here. */
  onSubmit?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  editable?: boolean;
  autoFocus?: boolean;
  /** Defaults to `label`; required when there is no label. */
  accessibilityLabel?: string;
  testID?: string;
  /** React 19 passes ref as an ordinary prop — do not reach for forwardRef. */
  ref?: Ref<TextInput>;
  style?: StyleProp<ViewStyle>;
};

/** SearchField's chrome, reused here: an 18pt inset and a 15pt leading glyph. */
const INSET = 18;
const ICON = 15;
/** Three lines of body copy is the shortest textarea any Phase 9 form asks for. */
const DEFAULT_MIN_LINES = 3;

/**
 * The app's text input (plan §Phase 9A). Figma never drew a form field, so the chrome is
 * SearchField's — the filled 52pt box at radii.xl — plus the four things a form needs and a
 * search box does not: a label, a helper line, an error state and a character count.
 *
 * The focus ring and the error announcement belong to the field rather than to each form: a
 * screen that forgets one of them ships an input with no visible focus and a validation failure
 * VoiceOver never says out loud.
 */
export function TextField({
  value,
  onChangeText,
  label,
  optional = false,
  suffix,
  trailing,
  placeholder,
  helper,
  error,
  icon,
  multiline = false,
  minLines,
  maxLength,
  showCount = false,
  keyboardType,
  autoCapitalize,
  autoComplete,
  secureTextEntry,
  returnKeyType,
  onSubmit,
  onBlur,
  onFocus,
  editable = true,
  autoFocus,
  accessibilityLabel,
  testID,
  ref,
  style,
}: TextFieldProps) {
  const { colors, motion, opacity, radii, sizes, spacing, typography, s } = useTheme();
  const revealOnFocus = useRevealOnFocus();
  const fieldRef = useRef<View>(null);
  const reduced = useReducedMotion();

  // Resolved here, on the JS side, for the reason Toggle resolves its scaled lengths there: the
  // worklet below captures these by value, and a token read from inside it would come off the UI
  // runtime's copy of the theme rather than this render's.
  //
  // The error colour is blended in by the same updater rather than layered on as a static style
  // after the animated one: React only owns borderColor until the first updater run: after that
  // Reanimated's props registry owns it and re-applies it over every commit, so a static override
  // later in the array would stop winning the moment the field was focused. One code path owns the
  // border at all times. The error has its own progress, so the border fades to red (and back)
  // rather than snapping when validation speaks.
  const restBorder = colors.surfaceSubtle;
  const focusedBorder = colors.surfaceSelected;
  const errorBorder = colors.danger;

  const focus = useSharedValue(0);
  const errorProgress = useSelectionProgress(Boolean(error));
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      errorProgress.value,
      [0, 1],
      [interpolateColor(focus.value, [0, 1], [restBorder, focusedBorder]), errorBorder],
    ),
  }));

  // Once per falsy→truthy transition. Announced explicitly because iOS has no live region, and
  // re-announcing on every keystroke while the same error stands would talk over the user typing
  // the fix.
  const previousError = useRef<string | undefined>(undefined);
  useEffect(() => {
    const wasShowing = Boolean(previousError.current);
    previousError.current = error;
    if (!error || wasShowing) return;
    AccessibilityInfo.announceForAccessibility(error);
    haptics.warning();
  }, [error]);

  // `TypeRole` takes leading off `TextStyle`, where it is optional; every role in the ramp sets
  // one, and sizes.textArea is the floor if some role ever does not.
  const bodyLine = typography.body.lineHeight ?? 0;
  const minHeight = Math.max(
    sizes.textArea,
    (minLines ?? DEFAULT_MIN_LINES) * bodyLine + 2 * spacing[3],
  );

  const message = error ?? helper;
  const showsHelperRow = Boolean(message) || (showCount && maxLength != null);

  return (
    // The measured node is the whole field, label and helper row included — scrolling the input
    // box alone into view would leave its label under the keyboard, which is the half that says
    // what you are typing into.
    <View ref={fieldRef} style={[{ gap: spacing[2] }, style]}>
      {label ? (
        <View style={[styles.labelRow, { gap: spacing[2] }]}>
          <Text variant="groupLabel">{label}</Text>
          {optional ? (
            <Text variant="micro" color="textTertiary">
              Optional
            </Text>
          ) : null}
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.field,
          multiline ? styles.fieldMultiline : null,
          {
            backgroundColor: colors.surfaceSubtle,
            borderRadius: radii.xl,
            borderWidth: sizes.border,
            paddingHorizontal: s(INSET),
            gap: spacing[3],
          },
          multiline ? { minHeight, paddingVertical: spacing[3] } : { height: sizes.searchField },
          editable ? null : { opacity: opacity.disabled },
          // Owns borderColor outright, error included — see restBorder/focusedBorder above.
          borderStyle,
        ]}
      >
        {icon ? (
          <FontAwesome5 name={icon} size={s(ICON)} color={colors.textSecondary} solid />
        ) : null}
        <TextInput
          ref={ref}
          testID={testID}
          // A field with neither a label nor an accessibilityLabel is unlabelled; callers that
          // drop the visible label (a sheet field, an inline row) have to pass one.
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={error ?? helper}
          // On the input, not the box: the input is the element a screen reader lands on.
          accessibilityState={{ disabled: !editable }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.textPrimary}
          cursorColor={colors.textPrimary}
          multiline={multiline}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          secureTextEntry={secureTextEntry}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmit}
          // RN 0.86 replaced blurOnSubmit with this. 'submit' keeps the keyboard and the focus
          // alive so a parent can hand it to the next field; a textarea keeps its newline.
          submitBehavior={
            multiline ? 'newline' : returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'
          }
          onFocus={() => {
            focus.set(withTiming(1, withReducedMotion(reduced, motion.timings.fast)));
            // Asks the page to scroll this field clear of the keyboard. `null` outside a
            // keyboard-aware scrolling Screen — in a sheet, the sheet does its own lifting.
            revealOnFocus?.(fieldRef.current);
            onFocus?.();
          }}
          onBlur={() => {
            focus.set(withTiming(0, withReducedMotion(reduced, motion.timings.fast)));
            onBlur?.();
          }}
          editable={editable}
          autoFocus={autoFocus}
          maxFontSizeMultiplier={maxFontScale.body}
          style={[
            styles.input,
            multiline ? styles.inputMultiline : null,
            typography.body,
            { color: colors.textPrimary },
          ]}
        />
        {suffix ? (
          <Text variant="caption" color="textSecondary" importantForAccessibility="no">
            {suffix}
          </Text>
        ) : null}
        {trailing}
      </Animated.View>

      {/* Rendered whenever the field has anything to say below it, so an error appearing swaps
          the message instead of pushing everything under it down a line. */}
      {showsHelperRow ? (
        <View style={[styles.helperRow, { gap: spacing[3] }]}>
          <Text
            variant="caption"
            color={error ? 'danger' : 'textSecondary'}
            accessibilityLiveRegion="polite"
            style={styles.helperMessage}
          >
            {message}
          </Text>
          {showCount && maxLength != null ? (
            // The hint already carries the limit, so the counter must not be a second stop —
            // hidden on both platforms, since each prop covers only one of them.
            <Text
              variant="captionSm"
              color="textTertiary"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {`${value.length}/${maxLength}`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center' },
  /** The glyph and the caret sit on the first line, not in the middle of a grown box. */
  fieldMultiline: { alignItems: 'flex-start' },
  input: { flex: 1, padding: 0, margin: 0, includeFontPadding: false },
  inputMultiline: { textAlignVertical: 'top' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  helperRow: { flexDirection: 'row', alignItems: 'flex-start' },
  helperMessage: { flex: 1 },
});
