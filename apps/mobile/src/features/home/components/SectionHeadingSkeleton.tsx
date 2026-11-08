import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** A section heading's line: "Top Job Matches" on the left, "View all" on the right. */
const HEADING = { title: 150, action: 56, height: 18 } as const;

/** A Home section heading's two bars: the title and its "View all". */
export function SectionHeadingSkeleton() {
  const { s } = useTheme();
  return (
    <View style={[styles.heading, { height: s(HEADING.height + 3) }]}>
      <Skeleton width={s(HEADING.title)} height={s(HEADING.height)} radius="full" />
      <Skeleton width={s(HEADING.action)} height={s(12)} radius="full" />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
