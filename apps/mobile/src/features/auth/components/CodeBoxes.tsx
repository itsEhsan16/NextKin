import { useEffect, useRef, useState } from 'react';
import { TextInput, type TextInputInstance } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { useShake } from '@/ui/motion';

export type CodeBoxesProps = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: boolean;
  /** The code was right: the boxes turn green in turn, each with a small bounce. */
  success?: boolean;
  disabled?: boolean;
};

/** One digit's box: it pops when its digit lands and fills green, in its turn, on success. */
function CodeBox({
  digit,
  index,
  active,
  error,
  success,
}: {
  digit: string;
  index: number;
  active: boolean;
  error: boolean;
  success: boolean;
}) {
  const { colors, radii, sizes, u } = useTheme();
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  const done = useSharedValue(0);

  useEffect(() => {
    if (!digit || reduced) return;
    pop.set(withSequence(withTiming(1.12, { duration: 90 }), withSpring(1, { damping: 12 })));
  }, [digit, pop, reduced]);

  useEffect(() => {
    if (!success) {
      done.set(0);
      return;
    }
    if (reduced) {
      done.set(1);
      return;
    }
    done.set(withDelay(index * 70, withTiming(1, { duration: 220 })));
    pop.set(
      withDelay(index * 70, withSequence(withTiming(1.14, { duration: 120 }), withSpring(1))),
    );
  }, [done, index, pop, reduced, success]);

  const rest = error ? colors.danger : active ? colors.brand : colors.borderDefault;
  const look = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    borderColor: interpolateColor(done.value, [0, 1], [rest, colors.success]),
    backgroundColor: interpolateColor(
      done.value,
      [0, 1],
      [colors.surfaceCard, colors.successSurface],
    ),
  }));

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          height: u(56),
          borderRadius: radii.xl,
          borderWidth: active || error || success ? sizes.borderThick : sizes.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        look,
      ]}
    >
      <Text variant="title2" color={success ? 'success' : 'ink'}>
        {digit}
      </Text>
    </Animated.View>
  );
}

/**
 * The verification code as six boxes over one hidden field (owner, 2026-11-08, §184), so paste
 * and the OS's one-time-code fill both land whole. A digit pops into its box, a wrong code
 * shakes the row, and a right one turns the boxes green one after another.
 */
export function CodeBoxes({
  length,
  value,
  onChange,
  onComplete,
  error = false,
  success = false,
  disabled = false,
}: CodeBoxesProps) {
  const { typography, u } = useTheme();
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(true);
  // A new key each time an error arrives, so every wrong code shakes, not just the first.
  // Derived during render (React's "adjust state on prop change"), not in an effect.
  const [tries, setTries] = useState(0);
  const [wasError, setWasError] = useState(error);
  if (error !== wasError) {
    setWasError(error);
    if (error) setTries(tries + 1);
  }
  const shake = useShake(error ? `wrong-${tries}` : null);

  return (
    <Pressable
      feedback="none"
      accessible={false}
      accessibilityRole="none"
      onPress={() => input.current?.focus()}
    >
      <Animated.View style={[{ flexDirection: 'row', gap: u(8) }, shake]}>
        {Array.from({ length }, (_, index) => (
          <CodeBox
            key={index}
            index={index}
            digit={value[index] ?? ''}
            active={focused && !success && index === Math.min(value.length, length - 1)}
            error={error}
            success={success}
          />
        ))}
      </Animated.View>
      <TextInput
        ref={input}
        testID="code-input"
        accessibilityLabel="Verification code"
        value={value}
        autoFocus
        editable={!disabled && !success}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={(text) => {
          const next = text.replace(/\D/g, '').slice(0, length);
          onChange(next);
          if (next.length === length) onComplete?.(next);
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        caretHidden
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: 0.01,
          color: 'transparent',
          fontSize: typography.body.fontSize,
        }}
      />
    </Pressable>
  );
}
