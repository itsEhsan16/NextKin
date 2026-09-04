import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback } from 'react';
import { View } from 'react-native';

import type { Job } from '@/data/models';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { SectionHeader } from '@/ui/SectionHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { JobMatchCard } from './JobMatchCard';

export type TopJobMatchesProps = {
  jobs: Job[] | undefined;
  status: 'pending' | 'error' | 'success';
  onViewAll: () => void;
  onPressJob: (job: Job) => void;
  onRetry: () => void;
};

const CARD_WIDTH = 288;
const CARD_GAP = 16;

/** Figma 1:95 + 1:100 — header row and the horizontally scrolling match cards. */
export function TopJobMatches({ jobs, status, onViewAll, onPressJob, onRetry }: TopJobMatchesProps) {
  const { spacing, s } = useTheme();
  const cardWidth = s(CARD_WIDTH);

  const renderItem = useCallback<ListRenderItem<Job>>(
    ({ item }) => <JobMatchCard job={item} width={cardWidth} onPress={onPressJob} />,
    [cardWidth, onPressJob],
  );

  return (
    <View style={{ gap: spacing[4] }}>
      <SectionHeader title="Top Job Matches" variant="homeSection" onAction={onViewAll} />

      {status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: s(CARD_GAP) }}>
          {[0, 1].map((i) => (
            <Card key={i} style={{ width: cardWidth, gap: spacing[3] }}>
              <Skeleton width={s(44)} height={s(44)} radius="lg" />
              <Skeleton width="60%" height={s(20)} />
              <Skeleton width="80%" height={s(16)} />
              <Skeleton width="50%" height={s(24)} radius="sm" />
            </Card>
          ))}
        </View>
      ) : status === 'error' ? (
        <Card>
          <StateView
            compact
            tone="danger"
            icon="exclamation-triangle"
            title="Couldn't load matches"
            actionLabel="Try again"
            onAction={onRetry}
          />
        </Card>
      ) : !jobs || jobs.length === 0 ? (
        <Card>
          <StateView
            compact
            icon="briefcase"
            title="No matches yet"
            message="Complete your profile and we'll surface jobs that fit."
            actionLabel="Find jobs"
            onAction={onViewAll}
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
          data={jobs}
          renderItem={renderItem}
          keyExtractor={(job) => job.id}
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={Separator}
          // s(CARD_GAP), not CARD_GAP — see the note in TodaysPicks: mixing a scaled card width
          // with a raw artboard gap drifts the snap point further off with every card.
          snapToInterval={cardWidth + s(CARD_GAP)}
          snapToAlignment="start"
          decelerationRate="fast"
          // Cards cast a small shadow; don't clip it on the vertical axis.
          contentContainerStyle={{ paddingVertical: s(2), paddingHorizontal: spacing.gutter }}
          style={{ marginHorizontal: -spacing.gutter }}
        />
      )}
    </View>
  );
}

function Separator() {
  const { s } = useTheme();
  return <View style={{ width: s(CARD_GAP) }} />;
}
