import { FlashList } from '@shopify/flash-list';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Job } from '@/data/models';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

import { JobPickCard } from './JobPickCard';

export type TodaysPicksProps = {
  picks: Job[] | undefined;
  status: 'pending' | 'error' | 'success';
  onPressJob: (job: Job) => void;
  onToggleSave: (job: Job) => void;
  onRetry: () => void;
};

const CARD_WIDTH = 300;
const GAP = 16;

/** Figma 1:299–1:324 — the "Today's picks" heading and its horizontal carousel. */
export function TodaysPicks({ picks, status, onPressJob, onToggleSave, onRetry }: TodaysPicksProps) {
  const { spacing, s } = useTheme();
  const cardWidth = s(CARD_WIDTH);

  const renderItem = useCallback(
    ({ item }: { item: Job }) => (
      <JobPickCard job={item} width={cardWidth} onPress={onPressJob} onToggleSave={onToggleSave} />
    ),
    [cardWidth, onPressJob, onToggleSave],
  );

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={styles.headingRow}>
        <Text accessibilityRole="header" variant="section">
          Today&apos;s picks
        </Text>
        <Text variant="caption" color="textSecondary">
          Refreshed daily
        </Text>
      </View>

      {status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: s(GAP) }}>
          {[0, 1].map((index) => (
            <Card key={index} style={{ width: cardWidth, gap: spacing[3] }}>
              <Skeleton width={s(40)} height={s(40)} radius="md" />
              <Skeleton width="70%" height={s(20)} />
              <Skeleton width="90%" height={s(16)} />
              <Skeleton width="45%" height={s(22)} radius="full" />
            </Card>
          ))}
        </View>
      ) : status === 'error' ? (
        <Card>
          <StateView
            compact
            tone="danger"
            icon="exclamation-triangle"
            title="Couldn't load picks"
            actionLabel="Try again"
            onAction={onRetry}
          />
        </Card>
      ) : !picks || picks.length === 0 ? (
        <Card>
          <StateView
            compact
            icon="briefcase"
            title="No picks today"
            message="Picks refresh daily — check back tomorrow."
          />
        </Card>
      ) : (
        /*
          Full-bleed. The row breaks out of the page gutter and pays it back as content padding,
          so the first card still lines up with the heading at rest but a scrolling card runs off
          the real screen edge instead of being sliced at the gutter with dead margin beside it.
          Boxed inside the gutter, a half-scrolled card reads as chopped rather than as content
          continuing off-screen — which is the whole difference from the reference.
        */
        <FlashList
          horizontal
          data={picks}
          renderItem={renderItem}
          keyExtractor={(job) => job.id}
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={Separator}
          // s(GAP), not GAP: the separator below is scaled, so an unscaled gap here would put
          // the snap interval 4dp past the real pitch at 390 and compound it card by card, until
          // the carousel rests mid-card and clips the title.
          snapToInterval={cardWidth + s(GAP)}
          snapToAlignment="start"
          decelerationRate="fast"
          // Cards cast a shadow; don't clip it on the cross axis.
          contentContainerStyle={{ paddingVertical: s(2), paddingHorizontal: spacing.gutter }}
          style={{ marginHorizontal: -spacing.gutter }}
        />
      )}
    </View>
  );
}

function Separator() {
  const { s } = useTheme();
  return <View style={{ width: s(GAP) }} />;
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
