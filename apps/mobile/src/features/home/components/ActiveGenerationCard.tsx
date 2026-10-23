import { memo } from 'react';
import Animated from 'react-native-reanimated';

import { useActiveGeneration } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { itemEnter, itemExit } from '@/ui/motion';

import { GenerationProgressCard } from './GenerationProgressCard';

export type ActiveGenerationCardProps = {
  onView: (generationId: string) => void;
  onRetry: (generationId: string) => void;
};

/**
 * Home's live generation card, owning its own subscription.
 *
 * The run pushes a progress tick into the cache every 1.2 s. Subscribed at the screen root, each
 * tick re-rendered all of Home; subscribed here, only this card does.
 *
 * `ready` is the end of the pipeline and the resume list already reflects it, so the card retires
 * rather than lingering on 100%. `failed` is terminal too but still needs surfacing, hence the
 * status check rather than `isGenerationTerminal`.
 *
 * It retires by shrinking away while Home's sections glide up into its place (§85), and a run
 * started from elsewhere fades in rather than shoving the page down in one frame.
 */
export const ActiveGenerationCard = memo(function ActiveGenerationCard({
  onView,
  onRetry,
}: ActiveGenerationCardProps) {
  const generation = useActiveGeneration().data;
  const reduced = useReducedMotion();
  if (!generation || generation.status === 'ready') return null;

  return (
    <Animated.View entering={itemEnter(reduced)} exiting={itemExit(reduced)}>
      <GenerationProgressCard
        generation={generation}
        onView={() => onView(generation.id)}
        onRetry={() => onRetry(generation.id)}
      />
    </Animated.View>
  );
});
