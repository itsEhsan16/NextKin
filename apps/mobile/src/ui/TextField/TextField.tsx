import { useRef, type ReactNode, type Ref } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  type ViewInstance,
  type TextInputInstance,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { maxFontScale } from '@/lib';
import { useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { useRevealOnFocus } from '@/ui/Screen';
import { Text } from '@/ui/Text';

import { useFieldChrome } from './useFieldChrome';

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
  /** Leading line icon, like SearchField's search icon. */
  icon?: LineIconName;
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
  ref?: Ref<TextInputInstance>;
  style?: StyleProp<ViewStyle>;
};

/** SearchField's chrome, reused here: an 18pt inset and a 15pt leading glyph. */
const INSET = 18;
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
  const { colors, opacity, radii, sizes, spacing, typography, s } = useTheme();
  const revealOnFocus = useRevealOnFocus();
  const fieldRef = useRef<ViewInstance>(null);

  // A visible edge at rest (a filled box with no edge read as a grey slab, not a field), the
  // selected ink on focus, red under an error — see useFieldChrome.
  const chrome = useFieldChrome(error, { rest: colors.borderDefault });

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
          // Owns borderColor outright, error included — see useFieldChrome.
          chrome.borderStyle,
        ]}
      >
        {icon ? <Icon name={icon} size="sm" color={colors.textSecondary} /> : null}
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
            chrome.onFocus();
            // Asks the page to scroll this field clear of the keyboard. `null` outside a
            // keyboard-aware scrolling Screen — in a sheet, the sheet does its own lifting.
            revealOnFocus?.(fieldRef.current);
            onFocus?.();
          }}
          onBlur={() => {
            chrome.onBlur();
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
