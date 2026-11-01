import { View } from 'react-native';

import type { LineSource } from '@/data/models';
import { useIsOnline, useLineSources } from '@/data/queries';
import { JobBullet } from '@/features/jobs/components/JobAboutSection';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pill, type PillTone } from '@/ui/Pill';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

const ORIGIN: Record<LineSource['origin'], { label: string; tone: PillTone; note: string }> = {
  generated: {
    label: 'Written by the AI',
    tone: 'brand',
    note: 'The AI wrote this from what’s listed here.',
  },
  user: { label: 'Your words', tone: 'neutral', note: 'From your resume, or typed by you.' },
  assumed: {
    label: 'Assumed',
    tone: 'warning',
    note: 'We guessed this. Check it before you download.',
  },
};

// The sheet's rhythm at 390 (PROFILE 21 573:820), in artboard units.
const TOP = 16 / 0.75;
const BOTTOM = 30 / 0.75;

export type LineSourceBodyProps = {
  line: string;
  source: LineSource | undefined;
  loading: boolean;
  failed: boolean;
};

/** What the sheet says, testable without its gestures and animation. */
export function LineSourceBody({ line, source, loading, failed }: LineSourceBodyProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const origin = source ? ORIGIN[source.origin] : undefined;

  return (
    <View style={[styles.body, { paddingHorizontal: spacing.gutter, gap: spacing[4] }]}>
      <View style={{ gap: spacing[2] }}>
        <Text {...a11yHeader()} variant="title">
          Where this came from
        </Text>
        <Text variant="body" color="textBody">
          {`“${line}”`}
        </Text>
      </View>

      {origin && source ? (
        <>
          <View style={{ gap: spacing[2] }}>
            <Pill label={origin.label} tone={origin.tone} style={styles.pill} />
            <Text variant="caption" color="textSecondary">
              {origin.note}
            </Text>
          </View>
          {source.facts.length > 0 ? (
            <View style={{ gap: spacing[2] }}>
              <Text variant="captionSemiBold">It rests on</Text>
              {source.facts.map((fact) => (
                <JobBullet key={fact} label={fact} />
              ))}
            </View>
          ) : null}
          {source.before ? (
            <View style={{ gap: spacing[2] }}>
              <Text variant="captionSemiBold">Your line before</Text>
              <Text variant="caption" color="textSecondary">
                {`“${source.before}”`}
              </Text>
            </View>
          ) : null}
        </>
      ) : loading ? (
        <View accessible accessibilityLabel="Loading" style={{ gap: spacing[2] }}>
          <Skeleton width={s(120)} height={s(24)} radius="full" />
          <Skeleton height={s(18)} />
        </View>
      ) : (
        <Text variant="caption" color="textSecondary">
          {failed
            ? 'We couldn’t load this. Check your connection and try again.'
            : 'This line has no source yet. It may have just changed.'}
        </Text>
      )}
    </View>
  );
}

export type LineSourceSheetProps = {
  resumeId: string;
  /** The line tapped; null keeps the sheet closed and asks for nothing. */
  line: string | null;
  onClose: () => void;
};

/**
 * "Where this came from" (owner, toreview §146.4): your words, the AI's, or a guess, with what it
 * rests on and the line it replaced. Spec-derived from the app's sheet, pill and bullets.
 */
export function LineSourceSheet({ resumeId, line, onClose }: LineSourceSheetProps) {
  const { sizes } = useTheme();
  const online = useIsOnline();
  const sources = useLineSources(line ? resumeId : '');

  return (
    <Sheet
      open={line !== null}
      onClose={onClose}
      height={sizes.sheetPickerHeight}
      accessibilityLabel="Where this came from"
    >
      <LineSourceBody
        line={line ?? ''}
        source={sources.data?.find((source) => source.text === line)}
        loading={sources.isPending}
        failed={sources.isError || !online}
      />
    </Sheet>
  );
}

const useStyles = scaledSheet((s) => ({
  body: { paddingTop: s(TOP), paddingBottom: s(BOTTOM) },
  pill: { alignSelf: 'flex-start' },
}));
