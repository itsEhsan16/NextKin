import { createContext, useContext, type ReactNode } from 'react';

import { a11yButton, hitSlop8 } from '@/lib';
import { Pressable } from '@/ui/Pressable';

/** Opens the sheet for a line. Absent, the same rows are plain text. */
export const LineSourceContext = createContext<((line: string) => void) | null>(null);

export type SourceLineProps = { text: string; children: ReactNode };

/**
 * A line of the resume page that says where it came from when tapped (owner, toreview §146.4). It
 * draws nothing of its own: the page looks as it did.
 */
export function SourceLine({ text, children }: SourceLineProps) {
  const open = useContext(LineSourceContext);
  if (!open) return children;
  return (
    <Pressable
      {...a11yButton(text, 'Shows where this came from')}
      feedback="subtle"
      haptic="selection"
      hitSlop={hitSlop8}
      onPress={() => open(text)}
    >
      {children}
    </Pressable>
  );
}
