import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import type { LineSource } from '@/data/models';
import { useLineSources } from '@/data/queries';
import { a11yButton, hitSlop8 } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';

export type LineSourceValue = {
  /** Opens the sheet for a line. */
  open: (line: string) => void;
  /** Who wrote a line, once the page's sources have loaded. */
  originOf: (line: string) => LineSource['origin'] | undefined;
};

/** Absent, the same rows are plain text. */
export const LineSourceContext = createContext<LineSourceValue | null>(null);

/** The page's sources, read once, so each line can say who wrote it. */
export function useLineSourceValue(
  resumeId: string,
  open: (line: string) => void,
): LineSourceValue {
  const sources = useLineSources(resumeId);
  return useMemo(() => {
    const origins = new Map(sources.data?.map((source) => [source.text, source.origin]));
    return { open, originOf: (line) => origins.get(line) };
  }, [open, sources.data]);
}

export type SourceLineProps = { text: string; children: ReactNode };

/**
 * A line of the resume page that says where it came from when tapped (owner, toreview §146.4). A
 * line the AI wrote, or guessed, sits on a light purple wash, so what was added shows at a glance
 * (owner, toreview §148.1). The person's own words stay plain, as does every line until the sources
 * load or with no connection.
 */
export function SourceLine({ text, children }: SourceLineProps) {
  const { colors, radii, s } = useTheme();
  const value = useContext(LineSourceContext);
  if (!value) return children;
  const origin = value.originOf(text);
  const added = origin === 'generated' || origin === 'assumed';
  return (
    <Pressable
      {...a11yButton(
        text,
        added ? 'Written by the AI. Shows where it came from' : 'Shows where this came from',
      )}
      feedback="subtle"
      haptic="selection"
      hitSlop={hitSlop8}
      onPress={() => value.open(text)}
    >
      {added ? (
        <View
          testID="ai-line"
          style={{
            backgroundColor: colors.brandSurface,
            borderRadius: radii.sm,
            paddingHorizontal: s(6),
            paddingVertical: s(2),
            marginHorizontal: -s(6),
          }}
        >
          {children}
        </View>
      ) : (
        children
      )}
    </Pressable>
  );
}
