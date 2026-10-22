import { useState } from 'react';

import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

export type BuildAddPasteBoxProps = {
  /** 'link' is BUILD 03's drawn box (653:23); 'description' is the same box, taller. */
  mode: 'link' | 'description';
  value: string;
  onChangeText: (text: string) => void;
  /** Set when 05b sends the user back to paste: the box opens focused. */
  autoFocus?: boolean;
};

/** Long enough for the longest posting anyone pastes (the Tailor intake's ceiling). */
const MAX_JD = 12000;
/** 653:23 is 107 tall at 390: a line of text over the Paste button. A posting gets six lines. */
const MIN_LINES = { link: 4, description: 6 } as const;
const PLACEHOLDER = {
  link: 'Paste a job link here…',
  description: 'Paste the job description here…',
} as const;

// The Paste button at 390 (653:25), in artboard units.
const PASTE_H = 38 / 0.75;
const PASTE_PAD_X = 18 / 0.75;
const PASTE_RADIUS = 11 / 0.75;
/** The button sits 12 in from the box's right and bottom edges (653:25 in 653:23). */
const PASTE_INSET = 12 / 0.75;

/** Structural stand-in for expo-clipboard's read, so nothing imports the package at module scope. */
type ClipboardReader = { getStringAsync(): Promise<string> };

/**
 * expo-clipboard is required lazily, as `@/lib/clipboard` does for writing: a static native import
 * would take the route (and Jest) down if the module were missing from the runtime.
 */
async function readClipboard(): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    const module = require('expo-clipboard') as ClipboardReader;
    return (await module.getStringAsync()) ?? '';
  } catch {
    return '';
  }
}

/**
 * BUILD 03's paste box (653:23): one multiline field for a link or the whole posting, with the
 * brand Paste button at its bottom-right that drops the clipboard in.
 */
export function BuildAddPasteBox({ mode, value, onChangeText, autoFocus }: BuildAddPasteBoxProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  const [reading, setReading] = useState(false);

  const paste = async () => {
    setReading(true);
    try {
      const text = (await readClipboard()).trim();
      // An empty clipboard leaves what is typed alone rather than wiping it.
      if (text) onChangeText(text);
    } finally {
      setReading(false);
    }
  };

  return (
    <TextField
      value={value}
      onChangeText={onChangeText}
      accessibilityLabel={mode === 'link' ? 'Job link' : 'Job description'}
      placeholder={PLACEHOLDER[mode]}
      multiline
      minLines={MIN_LINES[mode]}
      maxLength={MAX_JD}
      autoCapitalize="none"
      autoFocus={autoFocus}
      trailing={
        <Pressable
          {...a11yButton('Paste', 'Paste the link or description you copied')}
          accessibilityState={{ busy: reading }}
          feedback="scale"
          haptic="light"
          hitSlop={hitSlopFor(s(PASTE_H))}
          onPress={() => void paste()}
          style={[styles.paste, { backgroundColor: colors.brand }]}
        >
          <Text variant="bodySemiBold" color="textOnBrand">
            Paste
          </Text>
        </Pressable>
      }
    />
  );
}

const useStyles = scaledSheet((s) => ({
  // Over the box's corner, as drawn, rather than a column beside the text that would narrow every
  // line of a pasted posting.
  paste: {
    position: 'absolute',
    right: s(PASTE_INSET),
    bottom: s(PASTE_INSET),
    alignItems: 'center',
    justifyContent: 'center',
    height: s(PASTE_H),
    paddingHorizontal: s(PASTE_PAD_X),
    borderRadius: s(PASTE_RADIUS),
  },
}));
