import { useRef, useState } from 'react';
import { TextInput, View, type TextInputInstance } from 'react-native';

import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type CodeBoxesProps = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  /** Called once all digits are in. */
  onComplete?: (value: string) => void;
  error?: boolean;
};

/**
 * A one-time-code entry drawn as separate boxes (§172), over a single hidden input so paste,
 * SMS/email autofill and the system keyboard all just work.
 */
export function CodeBoxes({ length, value, onChange, onComplete, error = false }: CodeBoxesProps) {
  const { colors, radii, sizes, typography, u } = useTheme();
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(true);

  return (
    <Pressable
      feedback="none"
      accessible={false}
      accessibilityRole="none"
      onPress={() => input.current?.focus()}
      style={{ flexDirection: 'row', gap: u(8), justifyContent: 'space-between' }}
    >
      {Array.from({ length }, (_, index) => {
        const digit = value[index] ?? '';
        const active = focused && index === Math.min(value.length, length - 1);
        return (
          <View
            key={index}
            style={{
              flex: 1,
              height: u(56),
              borderRadius: radii.xl,
              borderWidth: active || error ? sizes.borderThick : sizes.border,
              borderColor: error ? colors.danger : active ? colors.brand : colors.borderDefault,
              backgroundColor: colors.surfaceCard,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="title2" color="ink">
              {digit}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        testID="code-input"
        accessibilityLabel="Verification code"
        value={value}
        autoFocus
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
