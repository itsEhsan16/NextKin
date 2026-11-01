import { View } from 'react-native';

import { JobBullet } from '@/features/jobs/components/JobAboutSection';
import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type ScoreNotMeasuredProps = { lines: readonly string[] };

/** "What this doesn't measure" (V2 §7.8, toreview §146.1): the engine's list, beside every score. */
export function ScoreNotMeasured({ lines }: ScoreNotMeasuredProps) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing[3] }}>
      <Text {...a11yHeader()} variant="title">
        What this doesn’t measure
      </Text>
      {lines.map((line) => (
        <JobBullet key={line} label={line} />
      ))}
    </View>
  );
}
