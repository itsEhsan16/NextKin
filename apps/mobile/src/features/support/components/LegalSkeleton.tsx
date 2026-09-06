import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Artboard lengths, each one a real line box of the page it stands in for:
 *
 * - `STAMP`    the 20pt caption line the "Last updated" stamp sits on
 * - `HEADING`  the 24pt `title` line a section heading sits on
 * - `LINE`     the 25pt `prose` leading, so a stack of them keeps the body's rhythm
 */
const STAMP = 20;
const HEADING = 24;
const LINE = 25;

/** Ragged right edges: a paragraph's last line stops short, and a flat block reads as a table. */
const TAILS = ['82%', '64%', '74%'] as const;

/** How many body lines each blocked-out section shows, before its heading. */
const SECTION_LINES = [4, 3, 4] as const;

/**
 * The legal document's loading state: heading-then-paragraph blocks in the rhythm of the prose
 * that replaces them, so the page does not reflow when the document lands. Never a spinner — a
 * long read wants its shape shown while it loads.
 */
export function LegalSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading document" style={{ gap: spacing[6] }}>
      <View style={{ gap: spacing[2] }}>
        <Skeleton width="40%" height={s(STAMP)} />
        <Skeleton height={s(LINE)} />
        <Skeleton width={TAILS[0]} height={s(LINE)} />
      </View>

      {SECTION_LINES.map((lines, index) => (
        <View key={`legal_skeleton_${index}`} style={{ gap: spacing[2] }}>
          <Skeleton width="55%" height={s(HEADING)} />
          {Array.from({ length: lines }, (_, line) => (
            <Skeleton
              key={`line_${line}`}
              width={line === lines - 1 ? (TAILS[index % TAILS.length] ?? '70%') : '100%'}
              height={s(LINE)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
