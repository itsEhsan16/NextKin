import { useCallback, useRef } from 'react';
import type { TextInputInstance } from 'react-native';

import type { TextFieldProps } from './TextField';

export type ChainLink = Required<Pick<TextFieldProps, 'ref' | 'returnKeyType'>> &
  Pick<TextFieldProps, 'onSubmit'>;

/**
 * The keyboard's Next key, wired: spread `link(i)` onto the i-th of `count` single-line fields and
 * Next hands focus to the field after it, while the last one says Done and puts the keyboard away.
 *
 * `returnKeyType="next"` alone is a promise the form does not keep — TextField holds the keyboard
 * up for a Next field so a parent can hand focus on, and nothing did, so the key looked dead.
 */
export function useFieldChain(count: number) {
  const inputs = useRef<(TextInputInstance | null)[]>([]);

  return useCallback(
    (index: number): ChainLink => {
      const last = index >= count - 1;
      return {
        ref: (node: TextInputInstance | null) => {
          inputs.current[index] = node;
        },
        returnKeyType: last ? 'done' : 'next',
        onSubmit: last ? undefined : () => inputs.current[index + 1]?.focus(),
      };
    },
    [count],
  );
}
